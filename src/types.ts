import { calendar_v3 } from "googleapis";

/**
 * ==========================
 * ======= DB TYPES =========
 * ==========================
 */

type TProviderType = "GOOGLE" | "STRIPE";

export interface Connection {
  id: string;
  user_id: string;
  provider: TProviderType;
  access_token: string;
  refresh_token?: string;
  sync_token?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  google_id: string;
  user_id: string;
  start_date_time: string;
  end_date_time: string;
  google_link: string;
  google_meets_link?: string;
}

export type CalendarEventCreateInput = Omit<CalendarEvent, "id">;

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

/**
 * Google Calendar Sync Queues
 */

export interface ICalendarSync {
  startCalendarSync: (userId: string) => Promise<void>;
  stopCalendarSync: (userId: string) => Promise<void>;
  restartCalendarSync: (userId: string) => Promise<void>;
}

export type TSyncQueueData = {
  userId: string;
};

/**
 * Queue Workers
 */

export interface IWorker {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  updateCFactor: (cFactor: number) => Promise<void>;
}
