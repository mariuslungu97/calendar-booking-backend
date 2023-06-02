import { Queue, JobsOptions } from "bullmq";

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
  logger.info("Start sync routine for user!");

  const authClient = googleAuthStore.getClient(userId);
  if (!authClient) {
    logger.info("Couldn't find auth client for user!");
    return;
  }

  const fullSyncEvery = 1000 * 60 * 60 * 24;
  // full sync every 24 hours
  await fullSyncQueue.add(
    "full",
    { userId },
    { jobId: userId, repeat: { every: fullSyncEvery } }
  );

  if (config.app.proto === "https") {
    // subscribe to calendar events notifications on behalf of the user
    const { watchCalendar } = calendarApi(authClient);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const subscribed = await watchCalendar({
      channelId: userId,
      expiration: targetDate.toISOString(),
      address: `${config.app.uri}${config.google.calendarWebhookUri}`,
    });

    // refresh channel event subscription one hour before expiration
    if (subscribed)
      await notificationChannelsRefreshQueue.add(
        "refresh",
        { userId },
        {
          jobId: userId,
          delay: Number(targetDate) - Number(Date.now()) - 60 * 60,
        }
      );
  } else if (config.app.proto === "http") {
    const incrementalSyncEvery = 1000 * 60 * 10; // 10 minutes

    // repeatable incremental sync
    await incrementalSyncQueue.add(
      "incremental",
      { userId },
      { jobId: userId, repeat: { every: incrementalSyncEvery } }
    );
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
    const { stopWatchCalendar } = calendarApi(authClient);

    await stopWatchCalendar({ channelId: userId });
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
  if (type === "fullSync")
    await fullSyncQueue.add(type, jobData, { ...jobOptions, jobId });
  else if (type === "incrementalSync")
    await incrementalSyncQueue.add(type, jobData, { ...jobOptions, jobId });
  else if (type === "channelRefresh")
    await notificationChannelsRefreshQueue.add(type, jobData, {
      ...jobOptions,
      jobId,
    });
};

const isUserInSync = async (userId: string) => {
  const fullSyncRepeatableJobs = await fullSyncQueue.getRepeatableJobs();
  const hasFullSyncJob = !!fullSyncRepeatableJobs.find(
    (rJob) => rJob.id === userId
  );

  let hasPeriodicSyncJob: boolean = false;
  if (config.app.proto === "https") {
    hasPeriodicSyncJob = !!(await notificationChannelsRefreshQueue.getJob(
      userId
    ));
  } else if (config.app.proto === "http") {
    const partialSyncRepeatableJobs =
      await incrementalSyncQueue.getRepeatableJobs();
    hasPeriodicSyncJob = !!partialSyncRepeatableJobs.find(
      (rJob) => rJob.id === userId
    );
  }

  return hasFullSyncJob && hasPeriodicSyncJob;
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
