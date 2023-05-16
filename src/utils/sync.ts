import { calendar_v3 } from "googleapis";

import knexClient from "../loaders/knex";

import { CalendarEvent, CalendarEventCreateInput } from "../types";

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

export { syncCalendarEvents };
