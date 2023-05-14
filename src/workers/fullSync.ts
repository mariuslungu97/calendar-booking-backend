import { Worker, Job } from "bullmq";

import logger from "../loaders/logger";
import knexClient from "../loaders/knex";
import calendarApi from "../services/googleCalendar";
import syncApi from "../services/calendarSync";
import { getOAuthClient } from "../services/googleOAuth";
import { syncCalendarEvents } from "../services/calendarSync";

import { Connection, TSyncQueueData, IWorker } from "../types";

type TSyncErrorReason = "CONNECTION_NOT_FOUND";
export class FullSyncProcessorError extends Error {
  public reason: TSyncErrorReason;
  constructor(message: string, reason: TSyncErrorReason) {
    super(message);
    this.reason = reason;
  }
}

const processor = async (job: Job<TSyncQueueData>): Promise<any> => {
  const { userId } = job.data;
  // grab google's access token
  try {
    const googleConnection = (
      await knexClient
        .select("id", "access_token", "refresh_token")
        .from<Connection>("connections")
        .where({ user_id: userId, provider: "GOOGLE" })
    )[0];

    if (!googleConnection)
      throw new FullSyncProcessorError(
        "Couldn't find an associated connection for user with provided id",
        "CONNECTION_NOT_FOUND"
      );

    // create auth client
    const userAuthClient = getOAuthClient();
    userAuthClient.setCredentials({
      access_token: googleConnection.access_token,
      refresh_token: googleConnection.refresh_token,
    });

    // get 6 months events starting from now
    const { getEvents } = calendarApi(userAuthClient);
    const dateNow = new Date();
    const dateNextSixMonths = new Date();
    dateNextSixMonths.setMonth(dateNextSixMonths.getMonth() + 6);

    const { data, syncToken } = await getEvents({
      timeMin: dateNow.toISOString(),
      timeMax: dateNextSixMonths.toISOString(),
    });

    // sync events
    syncCalendarEvents(data, userId);

    // update sync token
    await knexClient("connections")
      .update({ sync_token: syncToken })
      .where({ id: googleConnection.id });

    return;
  } catch (err) {
    logger.info("Encountered an unexpected error whilst processing a job!");
    throw err;
  }
};

const fullSyncWorker = new Worker<TSyncQueueData>(
  "calendarFullSync",
  processor,
  {
    concurrency: 10,
    autorun: false,
  }
);

fullSyncWorker.on("failed", async (job, error) => {
  if (!job) return;
  const { userId } = job.data;
  if (error instanceof FullSyncProcessorError) {
    if (error.reason === "CONNECTION_NOT_FOUND") {
      await syncApi.stopCalendarSync(userId);
    }
  }
});

const workerApi: IWorker = {
  start: async () => await fullSyncWorker.run(),
  stop: async () => await fullSyncWorker.close(),
  updateCFactor: async (cFactor: number) => {
    fullSyncWorker.concurrency = cFactor;
  },
};

export default workerApi;
