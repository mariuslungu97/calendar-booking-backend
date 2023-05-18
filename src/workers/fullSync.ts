import { Worker, Job } from "bullmq";

import logger from "../loaders/logger";
import knexClient from "../loaders/knex";
import calendarApi from "../services/googleCalendar";
import googleAuthStore from "../services/googleAuthClients";

import { syncCalendarEvents } from "../utils/sync";

import { TSyncJob } from "../types";

const processor = async (job: Job<TSyncJob>): Promise<any> => {
  const { userId } = job.data;

  try {
    // get auth client
    const authClient = googleAuthStore.getClient(userId);
    if (!authClient) throw new Error("Couldn't find the auth client in store!");

    // get 6 months events starting from now
    const { getEvents } = calendarApi(authClient);
    const dateNow = new Date();
    const dateNextSixMonths = new Date();
    dateNextSixMonths.setMonth(dateNextSixMonths.getMonth() + 6);

    const { data, syncToken } = await getEvents({
      timeMin: dateNow.toISOString(),
      timeMax: dateNextSixMonths.toISOString(),
    });

    // sync events
    await syncCalendarEvents(data, userId);

    // update sync token
    await knexClient("users")
      .update({ calendar_sync_token: syncToken })
      .where({ id: userId });

    return;
  } catch (err) {
    logger.info("Encountered an unexpected error whilst processing a job!");
    throw err;
  }
};

const fullSyncWorker = new Worker<TSyncJob>("calendarFullSync", processor, {
  concurrency: 10,
  autorun: false,
});

export default fullSyncWorker;
