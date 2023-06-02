import { Job, Worker } from "bullmq";
import dayjs from "dayjs";

import syncApi from "../services/calendarSync";
import calendarApi from "../services/googleCalendar";
import googleAuthStore from "../services/googleAuthClients";

import logger from "../loaders/logger";
import redisConnection from "../loaders/redis";

import { TSyncJob } from "../types";

const processor = async (job: Job<TSyncJob>) => {
  const { userId } = job.data;
  logger.info(
    `Processing channel notification refresh job for user with id ${userId}`
  );

  try {
    // get auth client
    const authClient = googleAuthStore.getClient(userId);
    if (!authClient) throw new Error("Couldn't find the auth client in store!");
    const { watchPrimaryCalendar, stopWatchPrimaryCalendar } =
      calendarApi(authClient);

    const stoppedWatching = await stopWatchPrimaryCalendar({
      channelId: userId,
    });
    if (!stoppedWatching)
      throw new Error("Couldn't stop watching primary calendar!");

    const expiration = dayjs().add(30, "day");
    await watchPrimaryCalendar({
      channelId: userId,
      expiration: expiration.toISOString(),
    });

    // make sure you resubscribe to the same channel 1 hour before it expires
    await syncApi.addOneTimeSyncJob(
      "channelRefresh",
      userId,
      { userId },
      {
        delay: expiration.subtract(1, "hour").diff(dayjs(), "millisecond"),
      }
    );
  } catch (err) {
    logger.info(
      "Encountered an unexpected error whilst processing a primary calendar notification channel job!"
    );
    throw err;
  }
};

const refreshNotificationChannelsWorker = new Worker(
  "refreshNotificationChannels",
  processor,
  {
    concurrency: 2,
    autorun: false,
    connection: redisConnection(),
  }
);

export default refreshNotificationChannelsWorker;
