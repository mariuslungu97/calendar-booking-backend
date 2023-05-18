import { calendar_v3 } from "googleapis";
import { Credentials, OAuth2Client } from "google-auth-library";
import { JobsOptions } from "bullmq";
import Stripe from "stripe";

export type TUserSessionData = { id: string; email: string };

/**
 * ==========================
 * ======= DB TYPES =========
 * ==========================
 */

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  is_email_verified: boolean;
  calendar_sync_token?: string;
  stripe_account_id?: string;
  is_deleted: boolean;
  deleted_at?: string;
  created_at: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  timezone: string;
}

export interface SchedulePeriod {
  id: string;
  schedule_id: string;
  day: number;
  start_time: string;
  end_time: string;
}

export type TOAuthConnectionProviderType = "GOOGLE";
export interface OAuthConnection {
  user_id: string;
  provider: TOAuthConnectionProviderType;
  access_token: string;
  refresh_token?: string;
  created_at: string;
}

export type TEventTypeLocationType = "G_MEET" | "ADDRESS" | "HOME";
export interface EventType {
  id: string;
  user_id?: string;
  schedule_id: string;
  link: string;
  name: string;
  duration: number;
  is_active: boolean;
  collects_payments: boolean;
  location: TEventTypeLocationType;
  description?: string;
  payment_fee?: number;
  location_phone_number?: string;
  location_address?: string;
  stripe_product_id?: string;
  stripe_price_id?: string;
  created_at: string;
}

export type TEventTypeQuestionType = "TEXT" | "RADIO" | "CHECKBOX";
export interface EventTypeQuestion {
  id: string;
  event_type_id: string;
  type: TEventTypeQuestionType;
  label: string;
  order: number;
  is_optional: boolean;
}

export interface EventTypeQuestionPossibleAnswer {
  id: string;
  question_id: string;
  value: string;
}

export interface CalendarEvent {
  id: string;
  google_id: string;
  event_id?: string;
  start_date_time: string;
  end_date_time: string;
  google_link: string;
}

export type TPaymentStatusType = "WAITING" | "SUCCESS" | "FAIL";
export interface Payment {
  id: string;
  user_id?: string;
  status: TPaymentStatusType;
  total_fee: number;
  application_fee: number;
  processor_payload: object;
  created_at: string;
  updated_at: string;
}

export type TEventStatusType =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "CANCELLED"
  | "FAILED_PAYMENT";

export interface Event {
  id: string;
  user_id?: string;
  event_type_id: string;
  payment_id: string;
  status: TEventStatusType;
  user_email: string;
  invitee_email: string;
  invitee_full_name: string;
  google_meets_link?: string;
  cancelled_at?: string;
  created_at: string;
}

export type TCreateInput<DbType> = Omit<
  DbType,
  "id" | "created_at" | "updated_at"
>;

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
 * Stripe Api
 */

export type TStripeCreateAccountParams = {
  firstName: string;
  lastName: string;
  email: string;
};

export type TStripeRetrieveAccountParams = {
  accountId: string;
};

export type TStripeCreateAccountLinkParams = {
  accountId: string;
};

export type TStripeCreateProductWithPriceParams = {
  accountId: string;
  productName: string;
  unitPrice: number;
};

export type TStripeCreatePaymentSessionParams = {
  accountId: string;
  priceId: string;
  eventId: string;
  applicationFee: number;
  shopperEmail: string;
};

export type TStripeDeleteProductWithPriceParams = {
  priceId: string;
  productId: string;
};

export interface IStripeApi {
  createAccount: (
    params: TStripeCreateAccountParams
  ) => Promise<Stripe.Account | null>;
  retrieveAccount: (
    params: TStripeRetrieveAccountParams
  ) => Promise<Stripe.Account | null>;
  createAccountLink: (
    params: TStripeCreateAccountLinkParams
  ) => Promise<Stripe.AccountLink | null>;
  createProductWithPrice: (
    params: TStripeCreateProductWithPriceParams
  ) => Promise<Stripe.Price | null>;
  createPaymentSession: (
    params: TStripeCreatePaymentSessionParams
  ) => Promise<Stripe.Checkout.Session | null>;
}

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
