import { Job, Worker } from "bullmq";

import syncApi from "../services/calendarSync";
import calendarApi from "../services/googleCalendar";
import googleAuthStore from "../services/googleAuthClients";

import config from "../config";
import logger from "../loaders/logger";

import { TSyncJob } from "../types";

const processor = async (job: Job<TSyncJob>) => {
  const { userId } = job.data;

  try {
    // get auth client
    const authClient = googleAuthStore.getClient(userId);
    if (!authClient) throw new Error("Couldn't find the auth client in store!");
    const { watchCalendar, stopWatchCalendar } = calendarApi(authClient);

    await stopWatchCalendar({
      channelId: userId,
    });

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    await watchCalendar({
      channelId: userId,
      address: `${config.app.uri}${config.google.calendarWebhookUri}`,
      expiration: targetDate.toISOString(),
    });

    // make sure you resubscribe to the same channel 1 hour before it expires
    await syncApi.addOneTimeSyncJob(
      "channelRefresh",
      userId,
      { userId },
      {
        delay: Number(targetDate) - Number(Date.now()) - 60 * 60,
      }
    );
  } catch (err) {
    logger.info("Encountered an unexpected error whilst processing a job!");
    throw err;
  }
};

const refreshNotificationChannelsWorker = new Worker(
  "refreshNotificationChannels",
  processor,
  {
    concurrency: 2,
    autorun: false,
  }
);

export default refreshNotificationChannelsWorker;
