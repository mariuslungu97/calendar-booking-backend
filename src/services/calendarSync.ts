import { Queue, ConnectionOptions } from "bullmq";
import { calendar_v3 } from "googleapis";

import knexClient from "../loaders/knex";
import logger from "../loaders/logger";
import config from "../config";

import {
  CalendarEvent,
  CalendarEventCreateInput,
  ICalendarSync,
  TSyncQueueData,
} from "../types";

const { host, port, user, password } = config.redis;
const connection: ConnectionOptions = {
  host,
  port,
  password,
  username: user,
};

const fullSyncQueue = new Queue<TSyncQueueData>("calendarFullSync", {
  connection,
});
const incrementalSyncQueue = new Queue<TSyncQueueData>(
  "calendarIncrementalSync",
  { connection }
);

const stopQueueRepeatableJob = async (queue: Queue, jobId: string) => {
  const repeatableJobs = await queue.getRepeatableJobs();
  const repeatableJob = repeatableJobs.find((rJob) => rJob.id === jobId);
  if (!repeatableJob) return;
  await queue.removeRepeatableByKey(repeatableJob.key);
};

const startCalendarSync = async (userId: string) => {
  logger.info(`Start Google Calendar sync for user with id ${userId}`);
  // full sync every 24 hours
  await fullSyncQueue.add(
    "full",
    { userId },
    {
      jobId: userId,
      repeat: { every: 1000 * 60 * 60 * 24 },
      removeOnComplete: true,
      removeOnFail: { age: 60 * 24 },
    }
  );

  // incremental sync every 15 minutes
  await incrementalSyncQueue.add(
    "incremental",
    { userId },
    {
      jobId: userId,
      repeat: { immediately: false, every: 1000 * 60 * 15 },
      removeOnComplete: true,
      removeOnFail: { age: 60 * 24 },
    }
  );
};

const stopCalendarSync = async (userId: string) => {
  logger.info(`Stop Google Calendar sync for user with id ${userId}`);

  await stopQueueRepeatableJob(fullSyncQueue, userId);
  await stopQueueRepeatableJob(incrementalSyncQueue, userId);
};

const restartCalendarSyncProcess = async (userId: string) => {
  await stopCalendarSync(userId);
  await startCalendarSync(userId);
};

const syncCalendarEvents = async (
  calendarEvents: calendar_v3.Schema$Event[],
  userId: string
) => {
  try {
    for (const calendarEvent of calendarEvents) {
      if (!calendarEvent.id) return;
      const isCancelled =
        calendarEvent.status && calendarEvent.status === "cancelled";
      const dbCalendarEvent = await knexClient
        .select("id")
        .from<CalendarEvent>("calendar_events")
        .where({ google_id: calendarEvent.id });

      if (isCancelled && dbCalendarEvent.length !== 0) {
        // delete record
        await knexClient("calendar_events")
          .where({ id: dbCalendarEvent[0].id })
          .del();
      } else if (!isCancelled && dbCalendarEvent.length !== 0) {
        // update record
        const updatedProperties: Partial<CalendarEvent> = {
          start_date_time: calendarEvent.start?.dateTime as string,
          end_date_time: calendarEvent.end?.dateTime as string,
          google_link:
            calendarEvent.htmlLink !== null
              ? calendarEvent.htmlLink
              : undefined,
          google_meets_link:
            calendarEvent.conferenceData?.conferenceId !== null
              ? calendarEvent.conferenceData?.conferenceId
              : undefined,
        };
        await knexClient("calendar_events")
          .where({ id: dbCalendarEvent[0].id })
          .update({ ...updatedProperties });
      } else if (!isCancelled && !dbCalendarEvent) {
        // insert record
        const newCalendarEvent: CalendarEventCreateInput = {
          user_id: userId,
          google_id: calendarEvent.id,
          start_date_time: calendarEvent.start?.dateTime as string,
          end_date_time: calendarEvent.end?.dateTime as string,
          google_link: calendarEvent.htmlLink as string,
          google_meets_link:
            calendarEvent.conferenceData?.conferenceId !== null
              ? calendarEvent.conferenceData?.conferenceId
              : undefined,
        };
        await knexClient("calendar_events").insert({ ...newCalendarEvent });
      }
    }
    return;
  } catch (err) {
    throw err;
  }
};

const syncApi: ICalendarSync = {
  startCalendarSync: async (userId: string) => await startCalendarSync(userId),
  stopCalendarSync: async (userId: string) => await stopCalendarSync(userId),
  restartCalendarSync: async (userId: string) =>
    await restartCalendarSyncProcess(userId),
};

export default syncApi;

export { syncCalendarEvents };
