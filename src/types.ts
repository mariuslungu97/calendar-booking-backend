import { calendar_v3 } from "googleapis";
import { Credentials, OAuth2Client } from "google-auth-library";
import { JobsOptions } from "bullmq";

export type TUserSessionData = { id: string; email: string };

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
export type ConnectionCreateInput = Omit<Connection, "id">;

/**
 * ==========================
 * ======= SERVICES =========
 * ==========================
 */

/**
 * Google OAuth API
 */

export interface IGoogleOAuthApi {
  generateOAuthUrl: () => string;
  getTokens: (authorizationCode: string) => Promise<Credentials | null>;
  getOAuthClient: () => OAuth2Client;
  getOAuthClientWithTokens: (
    authorizationCode: string
  ) => Promise<OAuth2Client | null>;
  revokeOAuthTokens: (accessToken: string) => Promise<void>;
}

/**
 * Gooogle OAuth Clients Store
 */

export interface IGoogleAuthClientsStore {
  addClient: (userId: string, authClient: OAuth2Client) => void;
  removeClient: (userId: string) => void;
  getClient: (userId: string) => OAuth2Client | null;
  hydrateStore: () => Promise<void>;
}

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
  expiration: string;
};

export type TStopWatchCalendarParams = {
  channelId: string;
};

export interface IGoogleCalendarApi {
  getEvent: (id: string) => Promise<calendar_v3.Schema$Event | null>;
  getEvents: (params: TGetEventsParams) => Promise<TGetEventsResponse>;
  createEvent: (
    input: TCreateEventInput
  ) => Promise<calendar_v3.Schema$Event | null>;
  deleteEvent: (id: string) => Promise<boolean>;
  watchCalendar: (params: TWatchCalendarParams) => Promise<boolean>;
  stopWatchCalendar: (params: TStopWatchCalendarParams) => Promise<boolean>;
}

/**
 * Google Calendar Sync Queues
 */

export type TSyncOneJobType = "fullSync" | "incrementalSync" | "channelRefresh";

export interface ICalendarSyncApi {
  startSyncRoutine: (userId: string) => Promise<void>;
  stopSyncRoutine: (userId: string) => Promise<void>;
  addOneTimeSyncJob: (
    type: TSyncOneJobType,
    jobId: string,
    jobData: any,
    jobOptions?: JobsOptions
  ) => Promise<void>;
}

export type TSyncJob = {
  userId: string;
};

/**
 * ==========================
 * ========= API ============
 * ==========================
 */

export interface IRestApiResponse<TData, TError> {
  code?: number;
  message?: string;
  data?: TData;
  error?: TError;
}

type TErrorReason = "UNAUTHORISED" | "UNAUTHENTICATED";
export class RestApiError extends Error {
  public reason: TErrorReason;

  constructor(message: string, reason: TErrorReason) {
    super(message);
    this.reason = reason;
  }
}
