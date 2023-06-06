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
  TWatchPrimaryCalendarParams,
  TStopWatchPrimaryCalendarParams,
} from "../types";

const calendar = google.calendar("v3");

type TSendUpdates = "all" | "externalOnly" | "none";
const calendarApi = (
  authClient: OAuth2Client,
  calendarId = "primary",
  sendCreateDeleteUpdates: TSendUpdates = "none"
): IGoogleCalendarApi => {
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
        auth: authClient,
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
        auth: authClient,
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
        auth: authClient,
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
          showDeleted: true,
          auth: authClient,
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

  const watchPrimaryCalendar = async (
    params: TWatchPrimaryCalendarParams
  ): Promise<boolean> => {
    const { channelId, expiration } = params;
    try {
      const response = await calendar.events.watch({
        calendarId,
        auth: authClient,
        requestBody: {
          expiration,
          id: channelId,
          type: "web_hook",
          address: `${config.app.uri}${config.google.calendarWebhookUri}`,
        },
      });
      if (response.data && response.data.id) return true;
      else return false;
    } catch (err) {
      logger.info("Failed to watch resource: ", err);
      return false;
    }
  };

  const stopWatchPrimaryCalendar = async (
    params: TStopWatchPrimaryCalendarParams
  ): Promise<boolean> => {
    const { channelId } = params;
    try {
      const primaryCalendarResponse = await calendar.calendars.get({
        calendarId: "primary",
      });
      if (!primaryCalendarResponse.data || !primaryCalendarResponse.data.id)
        return false;

      await calendar.channels.stop({
        auth: authClient,
        requestBody: {
          id: channelId,
          resourceId: primaryCalendarResponse.data.id,
        },
      });
      return true;
    } catch (err) {
      logger.info("Failed to stop watching resource: ", err);
      return false;
    }
  };

  return {
    createEvent,
    deleteEvent,
    getEvent,
    getEvents,
    watchPrimaryCalendar,
    stopWatchPrimaryCalendar,
  };
};

export default calendarApi;
