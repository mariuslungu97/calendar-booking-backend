import { calendar_v3 } from "googleapis";
import dayjs from "dayjs";

import knexClient from "../loaders/knex";

const syncCalendarEvents = async (
  calendarEvents: calendar_v3.Schema$Event[],
  userId: string
) => {
  try {
    for (const calendarEvent of calendarEvents) {
      if (!calendarEvent.id) return;

      const dbCalendarEvent = await knexClient
        .select("id", "google_id", "event_id", "event_schedule_id")
        .from("calendar_events")
        .where({ google_id: calendarEvent.id });

      const isCancelled =
        calendarEvent.status && calendarEvent.status === "cancelled";

      const dbAssociatedEventId = dbCalendarEvent[0].event_id;

      if (isCancelled && dbCalendarEvent.length !== 0) {
        // record exists in db; delete it and update associated event to reflect change

        await knexClient("calendar_events")
          .where({ id: dbCalendarEvent[0].id })
          .del();

        if (dbAssociatedEventId) {
          await knexClient("events").where({ id: dbAssociatedEventId }).update({
            status: "CANCELLED",
            cancelled_at: new Date().toISOString(),
          });
        }
      } else if (!isCancelled && dbCalendarEvent.length !== 0) {
        // record exists in db; update its associated schedule if it changed
        // you should inform the user something the schedule has changed and allow him to cancel
        // if it does not fit his schedule
        const dbCalendarEventSchedule = (
          await knexClient("event_schedules")
            .select()
            .where({ id: dbCalendarEvent[0].event_schedule_id })
        )[0];

        const startDateTime = new Date(
          calendarEvent.start?.dateTime as string
        ).toISOString();
        const endDateTime = new Date(
          calendarEvent.end?.dateTime as string
        ).toISOString();
        const duration = dayjs(endDateTime).diff(
          dayjs(startDateTime),
          "minute"
        );

        if (
          startDateTime !== dbCalendarEventSchedule.start_date_time ||
          endDateTime !== dbCalendarEventSchedule.end_date_time
        ) {
          // update record
          await knexClient("event_schedules")
            .where({ id: dbCalendarEvent[0].event_schedule_id })
            .update({
              start_date_time: startDateTime,
              end_date_time: endDateTime,
              duration,
            });
          // TODO notify invitee of change
        }
      } else if (!isCancelled && dbCalendarEvent.length === 0) {
        // create new event schedule and calendar event
        const startDateTime = dayjs(calendarEvent.start?.dateTime as string);
        const endDateTime = dayjs(calendarEvent.end?.dateTime as string);
        const duration = endDateTime.clone().diff(startDateTime, "minute");
        // create schedule
        const eventSchedule = await knexClient("event_schedules").insert(
          {
            start_date_time: startDateTime.unix().toString(),
            end_date_time: endDateTime.unix().toString(),
            duration,
          },
          ["id"]
        );

        // create calendar event
        await knexClient("calendar_events").insert({
          user_id: userId,
          event_schedule_id: eventSchedule[0].id,
          google_id: calendarEvent.id,
          google_link: calendarEvent.htmlLink as string,
        });
      }
    }
    return;
  } catch (err) {
    throw err;
  }
};

export { syncCalendarEvents };
