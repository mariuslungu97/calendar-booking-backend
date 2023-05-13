import { calendar_v3 } from "googleapis";

/**
 * ==========================
 * ======= SERVICES =========
 * ==========================
 */

/**
 * Google Calendar API
 */

type TCreateEventInputAttendee = {
  email: string;
  fullName: string;
};

type TCreateEventInputLocation = {
  type: "G_MEET" | "PHONE" | "ADDRESS";
  value?: string;
};

export type TCreateEventInput = {
  summary: string;
  startDateTime: string;
  endDateTime: string;
  description?: string;
  attendee: TCreateEventInputAttendee;
  location: TCreateEventInputLocation;
};

export type TGetEventsParams = {
  timeMin?: string;
  timeMax?: string;
  syncToken?: string;
};

export type TGetEventsResponse = {
  data: calendar_v3.Schema$Event[];
  syncToken: string | null;
  isSyncTokenInvalid: boolean;
};

export type TWatchCalendarParams = {
  channelId: string;
  address: string;
};

export interface IGoogleCalendarApi {
  getEvent: (id: string) => Promise<calendar_v3.Schema$Event | null>;
  getEvents: (params: TGetEventsParams) => Promise<TGetEventsResponse>;
  createEvent: (
    input: TCreateEventInput
  ) => Promise<calendar_v3.Schema$Event | null>;
  deleteEvent: (id: string) => Promise<boolean>;
  watchCalendar: (params: TWatchCalendarParams) => Promise<boolean>;
}
