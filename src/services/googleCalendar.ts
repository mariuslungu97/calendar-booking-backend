import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

import config from "../config";
import logger from "../loaders/logger";
import { randomString } from "../utils";

import {
  TCreateEventInput,
  TGetEventsParams,
  TGetEventsResponse,
  IGoogleCalendarApi,
  TWatchCalendarParams,
} from "../types";

const calendar = google.calendar("v3");

type TSendUpdates = "all" | "externalOnly" | "none";
const calendarApi = (
  authClient: OAuth2Client,
  calendarId = "primary",
  sendCreateDeleteUpdates: TSendUpdates = "none"
): IGoogleCalendarApi => {
  google.options({ auth: authClient });

  const createEvent = async (
    input: TCreateEventInput
  ): Promise<calendar_v3.Schema$Event | null> => {
    const {
      summary,
      description,
      startDateTime,
      endDateTime,
      attendee,
      location,
    } = input;
    const event: calendar_v3.Schema$Event = {
      summary,
      description,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      attendees: [{ email: attendee.email, displayName: attendee.fullName }],
      source: { title: "Calendar Booking App", url: config.app.uri },
      ...(location.type === "ADDRESS" && { location: location.value }),
      ...(location.type !== "ADDRESS" && {
        conferenceData: {
          ...(location.type === "G_MEET" && {
            createRequest: { requestId: randomString(16) },
            conferenceSolution: { key: { type: "hangoutsMeet" } },
          }),
          ...(location.type === "PHONE" && {
            entryPoints: [{ entryPointType: "phone", label: location.value }],
          }),
        },
      }),
    };

    try {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: event,
        sendUpdates: sendCreateDeleteUpdates,
      });
      return response.data;
    } catch (err) {
      logger.info("Failed to create a calendar event: ", err);
      return null;
    }
  };

  const deleteEvent = async (id: string): Promise<boolean> => {
    try {
      await calendar.events.delete({
        calendarId,
        eventId: id,
        sendUpdates: sendCreateDeleteUpdates,
      });
      return true;
    } catch (err) {
      logger.info("Failed to delete a calendar event: ", err);
      return false;
    }
  };

  const getEvent = async (
    id: string
  ): Promise<calendar_v3.Schema$Event | null> => {
    try {
      const response = await calendar.events.get({
        calendarId,
        eventId: id,
      });
      return response.data;
    } catch (err) {
      logger.info("Failed to delete a calendar event: ", err);
      return null;
    }
  };

  const getEvents = async (
    params: TGetEventsParams
  ): Promise<TGetEventsResponse> => {
    const { timeMin, timeMax, syncToken: initialSyncToken } = params;
    if (initialSyncToken && (timeMin || timeMax))
      throw new Error(
        "You cannot set a minimum or maximum time whilst providing a sync token!"
      );

    try {
      let events: calendar_v3.Schema$Event[] = [];
      let syncToken = null,
        pageToken = null;
      do {
        const response = await calendar.events.list({
          calendarId,
          timeMin,
          timeMax,
          syncToken: initialSyncToken,
          maxResults: 500,
          singleEvents: true,
        });
        const { items, nextPageToken, nextSyncToken } = response.data;
        if (items) events.push(...items);

        if (nextPageToken) pageToken = nextPageToken;
        else if (nextSyncToken) syncToken = nextSyncToken;
      } while (pageToken !== null);

      return { data: events, syncToken, isSyncTokenInvalid: false };
    } catch (err) {
      logger.info("Failed to get calendar events: ", err);
      const isSyncTokenInvalid =
        err && (err as any)?.code === 410 ? true : false;
      return { data: [], syncToken: null, isSyncTokenInvalid };
    }
  };

  const watchCalendar = async (
    params: TWatchCalendarParams
  ): Promise<boolean> => {
    const { channelId, address } = params;
    try {
      const response = await calendar.events.watch({
        calendarId,
        requestBody: {
          id: channelId,
          type: "webhook",
          address,
        },
      });
      if (response.data && response.data.id) return true;
      else return false;
    } catch (err) {
      logger.info("Failed to watch resource: ", err);
      return false;
    }
  };

  return {
    createEvent,
    deleteEvent,
    getEvent,
    getEvents,
    watchCalendar,
  };
};

export default calendarApi;
