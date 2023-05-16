import { Worker, Job } from "bullmq";

import logger from "../loaders/logger";
import knexClient from "../loaders/knex";
import calendarApi from "../services/googleCalendar";
import syncApi from "../services/calendarSync";
import googleAuthStore from "../services/googleAuthClients";

import { syncCalendarEvents } from "../utils/sync";

import { TSyncJob, Connection } from "../types";

type TSyncErrorReason = "SYNC_TOKEN_NOT_FOUND" | "INVALID_SYNC_TOKEN";
export class IncrementalSyncError extends Error {
  public reason: TSyncErrorReason;
  constructor(message: string, reason: TSyncErrorReason) {
    super(message);
    this.reason = reason;
  }
}

const processor = async (job: Job<TSyncJob>): Promise<any> => {
  const { userId } = job.data;

  try {
    const googleConnection = (
      await knexClient
        .select("id", "access_token", "refresh_token", "sync_token")
        .from<Connection>("connections")
        .where({ user_id: userId, provider: "GOOGLE" })
    )[0];

    if (!googleConnection.sync_token)
      throw new IncrementalSyncError(
        "Couldn't find a sync token for user with provided id!",
        "SYNC_TOKEN_NOT_FOUND"
      );

    // get auth client
    const authClient = googleAuthStore.getClient(userId);
    if (!authClient) throw new Error("Couldn't find the auth client in store!");

    const { getEvents } = calendarApi(authClient);
    const { data, syncToken, isSyncTokenInvalid } = await getEvents({
      syncToken: googleConnection.sync_token,
    });

    if (isSyncTokenInvalid)
      throw new IncrementalSyncError(
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

const incrementalSyncWorker = new Worker<TSyncJob>(
  "calendarIncrementalSync",
  processor,
  {
    concurrency: 10,
    autorun: false,
  }
);

incrementalSyncWorker.on("failed", async (job, error) => {
  if (!job) return;
  if (error instanceof IncrementalSyncError) {
    const { userId } = job.data;
    const { reason } = error;

    logger.info(
      `Encountered calendar sync error of type ${reason} whilst performing process!`
    );

    if (reason === "SYNC_TOKEN_NOT_FOUND") {
      syncApi.addOneTimeSyncJob("fullSync", userId, { userId });
    } else if (reason === "INVALID_SYNC_TOKEN") {
      syncApi.addOneTimeSyncJob("fullSync", userId, { userId });
    }
  }
});

export default incrementalSyncWorker;
