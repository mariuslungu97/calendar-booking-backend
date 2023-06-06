import { Queue, JobsOptions } from "bullmq";
import dayjs from "dayjs";

import calendarApi from "./googleCalendar";
import googleAuthStore from "./googleAuthClients";

import redisConnection from "../loaders/redis";
import logger from "../loaders/logger";
import config from "../config";

import { ICalendarSyncApi, TSyncJob, TSyncOneJobType } from "../types";

const stopQueueRepeatableJob = async (queue: Queue, jobId: string) => {
  const repeatableJobs = await queue.getRepeatableJobs();
  const repeatableJob = repeatableJobs.find((rJob) => rJob.id === jobId);
  if (!repeatableJob) return;
  await queue.removeRepeatableByKey(repeatableJob.key);
};

const hasRepeatableJob = async (queue: Queue, jobId: string) => {
  const repeatableJobs = await queue.getRepeatableJobs();
  const repeatableJob = repeatableJobs.find((rJob) => rJob.id === jobId);
  if (repeatableJob) return true;
  return false;
};

const fullSyncQueue = new Queue<TSyncJob>(
  "calendarFullSync", // eslint-disable-line
  { connection: redisConnection() }
);
const incrementalSyncQueue = new Queue<TSyncJob>(
  "calendarIncrementalSync", // eslint-disable-line
  { connection: redisConnection() }
);
const notificationChannelsRefreshQueue = new Queue<TSyncJob>(
  "refreshNotificationChannels", // eslint-disable-line
  { connection: redisConnection() }
);

const startSyncRoutine = async (userId: string) => {
  try {
    logger.info(
      `Starting Google Calendar sync routine for user with ID ${userId}`
    );

    const authClient = googleAuthStore.getClient(userId);
    if (!authClient) {
      throw new Error("Cannot find auth client!");
    }

    const FULL_SYNC_EVERY = 1000 * 60 * 60 * 24; // 24 hours
    await fullSyncQueue.add(
      "full",
      { userId },
      { jobId: userId, repeat: { every: FULL_SYNC_EVERY, immediately: true } }
    );

    if (config.app.proto === "https") {
      const { watchPrimaryCalendar } = calendarApi(authClient);
      const expirationDate = dayjs().add(30, "day");
      const isWatching = watchPrimaryCalendar({
        channelId: userId,
        expiration: expirationDate.toISOString(),
      });
      if (!isWatching)
        throw new Error("Did not manage to start watching primary calendar!");
      await notificationChannelsRefreshQueue.add(
        "refresh",
        { userId },
        {
          jobId: userId,
          delay: expirationDate
            .subtract(1, "hour")
            .diff(dayjs(), "millisecond"),
        }
      );
    } else if (config.app.proto === "http") {
      const INCREMENTAL_SYNC_EVERY = 1000 * 60 * 5; // 5 minutes
      await incrementalSyncQueue.add(
        "incremental",
        { userId },
        { jobId: userId, repeat: { every: INCREMENTAL_SYNC_EVERY } }
      );
    }
  } catch (err) {
    logger.error(
      "Unexpected error trying to start Google calendar syncing process!"
    );
    logger.error(err);
    await stopSyncRoutine(userId); // make sure we're not partially synced
  }
};

const stopSyncRoutine = async (userId: string) => {
  logger.info(`Stop sync routine for user!`);

  const authClient = googleAuthStore.getClient(userId);
  if (!authClient) {
    logger.info("Couldn't find auth client for user!");
    return;
  }

  await stopQueueRepeatableJob(fullSyncQueue, userId);

  if (config.app.proto === "https") {
    const { stopWatchPrimaryCalendar } = calendarApi(authClient);

    await stopWatchPrimaryCalendar({ channelId: userId });
    await notificationChannelsRefreshQueue.remove(userId);
  } else if (config.app.proto === "http") {
    await stopQueueRepeatableJob(incrementalSyncQueue, userId);
  }
};

const addOneTimeSyncJob = async (
  type: TSyncOneJobType,
  jobId: string,
  jobData: TSyncJob,
  jobOptions?: JobsOptions
) => {
  logger.info(`Adding one time Google Calendar sync job!`);

  if (type === "fullSync")
    await fullSyncQueue.add("full", jobData, { ...jobOptions, jobId });
  else if (type === "incrementalSync")
    await incrementalSyncQueue.add("incremental", jobData, { ...jobOptions, jobId }); // prettier-ignore
  else if (type === "channelRefresh")
    await notificationChannelsRefreshQueue.add("refresh", jobData, { ...jobOptions, jobId }); // prettier-ignore
};

const isUserInSync = async (userId: string) => {
  const hasFullSyncJob = await hasRepeatableJob(fullSyncQueue, userId);

  let hasIncrementalSyncJob = false;
  let hasChannelsRefreshJob = false;

  if (config.app.proto === "https") {
    hasChannelsRefreshJob = !!(await notificationChannelsRefreshQueue.getJob(
      userId
    ));
  } else if (config.app.proto === "http") {
    hasIncrementalSyncJob = await hasRepeatableJob(
      incrementalSyncQueue,
      userId
    );
  }

  return hasFullSyncJob && (hasIncrementalSyncJob || hasChannelsRefreshJob);
};

const syncApi: ICalendarSyncApi = {
  isUserInSync,
  startSyncRoutine,
  stopSyncRoutine,
  addOneTimeSyncJob,
};

export {
  fullSyncQueue,
  incrementalSyncQueue,
  notificationChannelsRefreshQueue,
};
export default syncApi;
