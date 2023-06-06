import { Worker, Job } from "bullmq";

import redisConnection from "../loaders/redis";
import logger from "../loaders/logger";
import knexClient from "../loaders/knex";
import calendarApi from "../services/googleCalendar";
import syncApi from "../services/calendarSync";
import googleAuthStore from "../services/googleAuthClients";

import { syncCalendarEvents } from "../utils/sync";

import { TSyncJob } from "../types";

type TSyncErrorReason =
  | "USER_NOT_FOUND"
  | "SYNC_TOKEN_NOT_FOUND"
  | "INVALID_SYNC_TOKEN";
export class IncrementalSyncError extends Error {
  public reason: TSyncErrorReason;
  constructor(message: string, reason: TSyncErrorReason) {
    super(message);
    this.reason = reason;
  }
}

const processor = async (job: Job<TSyncJob>): Promise<any> => {
  const { userId } = job.data;
  logger.info(
    `Processing incremental sync calendar job for user with id ${userId}`
  );

  try {
    const userList = await knexClient("users")
      .select("calendar_sync_token")
      .where({ id: userId });

    if (!userList.length)
      throw new IncrementalSyncError(
        "Couldn't find a user with provided id!",
        "USER_NOT_FOUND"
      );
    const user = userList[0];

    if (!user.calendar_sync_token)
      throw new IncrementalSyncError(
        "Couldn't find a calendar sync token for user with provided id!",
        "SYNC_TOKEN_NOT_FOUND"
      );

    // get auth client
    const authClient = googleAuthStore.getClient(userId);
    if (!authClient) throw new Error("Couldn't find the auth client in store!");

    const { getEvents } = calendarApi(authClient);
    const { data, syncToken, isSyncTokenInvalid } = await getEvents({
      syncToken: user.calendar_sync_token,
    });

    if (isSyncTokenInvalid)
      throw new IncrementalSyncError(
        "The associated sync token has become invalid!",
        "INVALID_SYNC_TOKEN"
      );

    await syncCalendarEvents(data, userId);

    await knexClient("users")
      .where({ id: userId })
      .update({ calendar_sync_token: syncToken });

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
    connection: redisConnection(),
  }
);

incrementalSyncWorker.on("failed", async (job, error) => {
  if (!job) return;
  if (error instanceof IncrementalSyncError) {
    const { userId } = job.data;
    const { reason } = error;

    logger.info(
      `Encountered calendar sync error of type ${reason} whilst performing an incremental sync process!`
    );

    if (reason === "USER_NOT_FOUND") {
      await syncApi.stopSyncRoutine(userId);
    } else if (reason === "SYNC_TOKEN_NOT_FOUND") {
      await syncApi.addOneTimeSyncJob("fullSync", userId, { userId });
    } else if (reason === "INVALID_SYNC_TOKEN") {
      await syncApi.addOneTimeSyncJob("fullSync", userId, { userId });
    }
  }
});

export default incrementalSyncWorker;
