import { calendar_v3 } from "googleapis";
import dayjs from "dayjs";

import logger from "../loaders/logger";
import knexClient from "../loaders/knex";
import mailService from "../services/mail";

import { CalendarEvent, TTimeSlotString } from "../types";

const sendCancelMail = async (eventId: string) => {
  try {
    const event = (
      await knexClient("events")
        .select(
          "invitee_email",
          "invitee_timezone",
          "event_schedule_id",
          "user_id",
          "event_type_id"
        )
        .where("id", eventId)
    )[0];
    const eventSchedule = (
      await knexClient("event_schedules")
        .select("start_date_time", "end_date_time")
        .where("id", event.event_schedule_id)
    )[0];
    const eventTypeName = (
      await knexClient("event_types")
        .select("name")
        .where("id", event.event_type_id)
    )[0].name;
    const userList = await knexClient("users")
      .select("first_name", "last_name")
      .where("id", event.user_id);
    const userFullName =
      userList.length !== 0
        ? userList[0].first_name + userList[0].last_name
        : "";

    mailService.sendMail({
      type: "CANCEL_EVENT",
      to: event.invitee_email,
      payload: {
        userFullName,
        eventTypeName,
        displayTimezone: event.invitee_timezone,
        eventDateTime: {
          start: eventSchedule.start_date_time,
          end: eventSchedule.end_date_time,
        },
      },
    });

    return;
  } catch (err) {
    logger.error("Unexpected error trying to send a cancel event mail!");
    logger.error(err);
    throw err;
  }
};

const sendTimeUpdateMail = async (
  eventId: string,
  pastDate: TTimeSlotString,
  newDate: TTimeSlotString
) => {
  try {
    const event = (
      await knexClient("events")
        .select(
          "id",
          "event_type_id",
          "invitee_email",
          "location_value",
          "invitee_timezone"
        )
        .where("id", eventId)
    )[0];

    const eventTypeName = (
      await knexClient("event_types")
        .select("name")
        .where("id", event.event_type_id)
    )[0].name;

    mailService.sendMail({
      to: event.invitee_email,
      type: "NOTIFY_EVENT_UPDATE",
      payload: {
        eventTypeName,
        eventId: event.id,
        displayTimezone: event.invitee_timezone,
        eventLocation: event.location_value as string,
        pastDateTime: { start: pastDate[0], end: pastDate[1] },
        newDateTime: { start: newDate[0], end: newDate[1] },
      },
    });

    return;
  } catch (err) {
    logger.error(
      "Unexpected error trying to send an update confirmation event mail!"
    );
    logger.error(err);
    throw err;
  }
};

const syncCalendarEvent = async (
  userId: string,
  googleCalendarEvent: calendar_v3.Schema$Event,
  dbCalendarEvent: CalendarEvent | null
) => {
  try {
    const isCancelled =
      googleCalendarEvent.status && googleCalendarEvent.status === "cancelled";

    if (isCancelled && dbCalendarEvent) {
      await knexClient("calendar_events").del().where("id", dbCalendarEvent.id);

      if (!dbCalendarEvent.event_id) {
        // we can safely delete calendar event associated schedule
        await knexClient("event_schedules")
          .del()
          .where("id", dbCalendarEvent.event_schedule_id);
      } else if (dbCalendarEvent.event_id) {
        // update event as cancelled and inform invitee
        await knexClient("events")
          .update({
            status: "CANCELLED",
            cancelled_at: dayjs().toISOString(),
          })
          .where("id", dbCalendarEvent.event_id);

        await sendCancelMail(dbCalendarEvent.event_id);
      }
    } else if (!isCancelled && dbCalendarEvent) {
      const dbCalendarEventSchedule = (
        await knexClient("event_schedules")
          .select("start_date_time", "end_date_time")
          .where("id", dbCalendarEvent.event_schedule_id)
      )[0];

      const startDateTime = dayjs(googleCalendarEvent.start?.dateTime);
      const endDateTime = dayjs(googleCalendarEvent.end?.dateTime);

      if (
        !startDateTime.isSame(
          dayjs(dbCalendarEventSchedule.start_date_time),
          "minute"
        ) ||
        !endDateTime.isSame(
          dayjs(dbCalendarEventSchedule.end_date_time),
          "minute"
        )
      ) {
        await knexClient("event_schedules")
          .update({
            start_date_time: startDateTime.toISOString(),
            end_date_time: endDateTime.toISOString(),
            duration: endDateTime.diff(startDateTime, "minute"),
          })
          .where("id", dbCalendarEvent.event_schedule_id);

        if (dbCalendarEvent.event_id) {
          await sendTimeUpdateMail(
            dbCalendarEvent.event_id,
            [
              dbCalendarEventSchedule.start_date_time,
              dbCalendarEventSchedule.end_date_time,
            ],
            [startDateTime.toISOString(), endDateTime.toISOString()]
          );
        }
      }
    } else if (!isCancelled && !dbCalendarEvent) {
      const startDateTime = dayjs(googleCalendarEvent.start?.dateTime);
      const endDateTime = dayjs(googleCalendarEvent.end?.dateTime);
      const duration = endDateTime.diff(startDateTime, "minute");

      const eventSchedule = (
        await knexClient("event_schedules").insert(
          {
            start_date_time: startDateTime.toISOString(),
            end_date_time: endDateTime.toISOString(),
            duration,
          },
          ["id"]
        )
      )[0];

      await knexClient("calendar_events").insert({
        user_id: userId,
        google_id: googleCalendarEvent.id,
        event_schedule_id: eventSchedule.id,
        google_link: googleCalendarEvent.htmlLink as string,
      });
    }
  } catch (err) {
    logger.error(
      "Unexpected error attempting to sync Google calendar event with our database records!"
    );
    logger.error(err);
    throw err;
  }
};

const syncCalendarEvents = async (
  calendarEvents: calendar_v3.Schema$Event[],
  userId: string
) => {
  try {
    for (const calendarEvent of calendarEvents) {
      if (!calendarEvent.id) continue;

      const dbCalendarEventList = await knexClient("calendar_events")
        .select("*")
        .where({ google_id: calendarEvent.id });

      const dbCalendarEvent =
        dbCalendarEventList.length !== 0 ? dbCalendarEventList[0] : null;

      await syncCalendarEvent(userId, calendarEvent, dbCalendarEvent);
    }
    return;
  } catch (err) {
    logger.error("Unexpected error trying to sync calendar events!");
    logger.error(err);
    throw err;
  }
};

export { syncCalendarEvents };
