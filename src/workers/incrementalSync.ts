import { Worker, Job } from "bullmq";

import logger from "../loaders/logger";
import knexClient from "../loaders/knex";
import calendarApi from "../services/googleCalendar";
import syncApi from "../services/calendarSync";
import { getOAuthClient } from "../services/googleOAuth";
import { syncCalendarEvents } from "../services/calendarSync";

import { TSyncQueueData, Connection, IWorker } from "../types";

type TSyncErrorReason =
  | "CONNECTION_NOT_FOUND"
  | "SYNC_TOKEN_NOT_FOUND"
  | "INVALID_SYNC_TOKEN";
export class IncrementalSyncProcessorError extends Error {
  public reason: TSyncErrorReason;
  constructor(message: string, reason: TSyncErrorReason) {
    super(message);
    this.reason = reason;
  }
}

const processor = async (job: Job<TSyncQueueData>): Promise<any> => {
  const { userId } = job.data;

  try {
    const googleConnection = (
      await knexClient
        .select("id", "access_token", "refresh_token", "sync_token")
        .from<Connection>("connections")
        .where({ user_id: userId, provider: "GOOGLE" })
    )[0];

    if (!googleConnection)
      throw new IncrementalSyncProcessorError(
        "Couldn't find an associated connection for user with provided id!",
        "CONNECTION_NOT_FOUND"
      );
    else if (!googleConnection.sync_token)
      throw new IncrementalSyncProcessorError(
        "Couldn't find a sync token for user with provided id!",
        "SYNC_TOKEN_NOT_FOUND"
      );

    // create auth client
    const userAuthClient = getOAuthClient();
    userAuthClient.setCredentials({
      access_token: googleConnection.access_token,
      refresh_token: googleConnection.refresh_token,
    });

    const { getEvents } = calendarApi(userAuthClient);
    const { data, syncToken, isSyncTokenInvalid } = await getEvents({
      syncToken: googleConnection.sync_token,
    });

    if (isSyncTokenInvalid)
      throw new IncrementalSyncProcessorError(
        "The associated sync token has become invalid!",
        "INVALID_SYNC_TOKEN"
      );

    await syncCalendarEvents(data, userId);

    await knexClient("connections")
      .where({ id: googleConnection.id })
      .update({ syncToken });

    return;
  } catch (err) {
    logger.info("Encountered an unexpected error whilst processing a job!");
    throw err;
  }
};

const incrementalSync = new Worker<TSyncQueueData>(
  "calendarIncrementalSync",
  processor,
  {
    concurrency: 10,
    autorun: false,
  }
);

incrementalSync.on("failed", async (job, error) => {
  if (!job) return;
  const { userId } = job.data;
  if (error instanceof IncrementalSyncProcessorError) {
    if (error.reason === "CONNECTION_NOT_FOUND") {
      await syncApi.stopCalendarSync(userId);
    } else if (error.reason === "SYNC_TOKEN_NOT_FOUND") {
      await syncApi.restartCalendarSync(userId);
    } else if (error.reason === "INVALID_SYNC_TOKEN") {
      await syncApi.restartCalendarSync(userId);
    }
  }
});

const workerApi: IWorker = {
  start: async () => await incrementalSync.run(),
  stop: async () => await incrementalSync.close(),
  updateCFactor: async (cFactor: number) => {
    incrementalSync.concurrency = cFactor;
  },
};

export default workerApi;
