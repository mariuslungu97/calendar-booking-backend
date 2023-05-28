import { calendar_v3 } from "googleapis";
import { Credentials, OAuth2Client } from "google-auth-library";
import { JobsOptions } from "bullmq";
import { Dayjs } from "dayjs";
import Stripe from "stripe";
import { Request, Response } from "express";
import { Knex } from "knex";

export type TUserSessionData = { id: string; email: string };

/**
 * ==========================
 * ======= DB TYPES =========
 * ==========================
 */

export interface StripeAccount {
  id: string;
  details_submitted: boolean;
  charges_enabled: boolean;
  capabilities_enabled: boolean;
  created_at: string;
  updated_at: string;
}
export type TStripeAccountCreateInput = {
  id: string;
};
export type TStripeAccountUpdateParams = Omit<
  StripeAccount,
  "id" | "created_at"
>;

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  is_email_verified: boolean;
  is_2fa_activated: boolean;
  calendar_sync_token?: string | null;
  stripe_account_id?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  created_at: string;
}
export type TUserCreateInput = {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};
export type TUserUpdateParams = Partial<
  Omit<User, "id" | "email" | "created_at">
>;

export interface Schedule {
  id: string;
  user_id: string;
  timezone: string;
}
export type TScheduleCreateInput = Omit<Schedule, "id">;
export type TScheduleUpdateParams = Partial<Omit<Schedule, "id" | "user_id">>;

export interface SchedulePeriod {
  id: string;
  schedule_id: string;
  day: number;
  start_time: string;
  end_time: string;
}
export type TSchedulePeriodCreateInput = Omit<SchedulePeriod, "id">;
export type TSchedulePeriodUpdateParams = Partial<
  Omit<SchedulePeriod, "id" | "schedule_id">
>;

export type TOAuthConnectionProviderType = "GOOGLE";
export interface OAuthConnection {
  user_id: string;
  provider: TOAuthConnectionProviderType;
  access_token: string;
  refresh_token?: string | null;
  created_at: string;
}
export type TOAuthConnectionCreateInput = Omit<OAuthConnection, "created_at">;
export type TOAuthConnectionUpdateParams = Partial<
  Omit<OAuthConnection, "user_id" | "provider" | "created_at">
>;

export type TEventTypeLocationType = "G_MEET" | "ADDRESS" | "HOME";
export interface EventType {
  id: string;
  user_id?: string | null;
  schedule_id: string;
  link: string;
  name: string;
  duration: number;
  is_active: boolean;
  collects_payments: boolean;
  location: TEventTypeLocationType;
  description?: string | null;
  payment_fee?: number | null;
  location_value?: string | null;
  stripe_product_id?: string | null;
  stripe_price_id?: string | null;
  created_at: string;
  updated_at: string;
}
export type TEventTypeCreateInput = Omit<
  EventType,
  "id" | "created_at" | "updated_at" | "is_active"
>;
export type TEventTypeUpdateParams = Partial<
  Omit<EventType, "id" | "user_id" | "created_at">
>;

export type TEventTypeQuestionType = "TEXT" | "RADIO" | "CHECKBOX";
export interface EventTypeQuestion {
  id: string;
  event_type_id: string;
  type: TEventTypeQuestionType;
  label: string;
  order: number;
  is_optional: boolean;
}
export type TEventTypeQuestionCreateInput = Omit<EventTypeQuestion, "id">;
export type TEventTypeQuestionUpdateParams = Partial<
  Omit<EventType, "id" | "event_type_id">
>;

export interface EventTypeQuestionPossibleAnswer {
  id: string;
  question_id: string;
  value: string;
}
export type TEventTypeQuestionPossibleAnswerCreateInput = Omit<
  EventTypeQuestionPossibleAnswer,
  "id"
>;
export type TEventTypeQuestionPossibleAnswerUpdateParams = Partial<
  Omit<EventTypeQuestionPossibleAnswer, "id" | "question_id">
>;

export interface EventSchedule {
  id: string;
  start_date_time: string;
  end_date_time: string;
  duration: number;
}
export type TEventScheduleCreateInput = Omit<EventSchedule, "id">;
export type TEventScheduleUpdateParams = Partial<Omit<EventSchedule, "id">>;

export interface CalendarEvent {
  id: string;
  google_id: string;
  user_id: string;
  event_schedule_id: string;
  event_id?: string | null;
  google_link: string;
}
export type TCalendarEventCreateInput = Omit<CalendarEvent, "id">;
export type TCalendarEventUpdateParams = Partial<
  Omit<
    CalendarEvent,
    "id" | "google_id" | "user_id" | "schedule_id" | "event_id"
  >
>;

export type TPaymentStatusType = "WAITING" | "SUCCESS" | "FAIL";
export interface Payment {
  id: string;
  user_id?: string | null;
  stripe_session_id: string;
  stripe_payment_intent_id: string;
  status: TPaymentStatusType;
  total_fee: number;
  application_fee: number;
  processor_payload: object;
  created_at: string;
  updated_at: string;
}
export type TPaymentCreateInput = Omit<
  Payment,
  "id" | "status" | "created_at" | "updated_at"
>;
export type TPaymentUpdateParams = Partial<
  Omit<Payment, "id" | "user_id" | "created_at">
>;

export type TEventStatusType =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "CANCELLED"
  | "FAILED_PAYMENT";

export interface Event {
  id: string;
  user_id?: string | null;
  event_type_id: string;
  event_schedule_id: string;
  payment_id: string;
  status: TEventStatusType;
  user_email: string;
  invitee_email: string;
  invitee_full_name: string;
  user_timezone: string;
  invitee_timezone: string;
  location_value: string;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}
export type TEventCreateInput = Omit<Event, "id" | "created_at">;
export type TEventUpdateParams = Partial<
  Omit<Event, "id" | "user_id" | "event_type_id" | "payment_id" | "created_at">
>;

export interface EventAnswer {
  event_id: string;
  question_id: string;
  value: string;
}
export type TEventAnswerCreateInput = EventAnswer;
export type TEventAnswerUpdateParams = Partial<
  Omit<EventAnswer, "event_id" | "question_id">
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
  addClient: (
    userId: string,
    authClient: OAuth2Client,
    publish?: boolean
  ) => void;
  removeClient: (userId: string, publish?: boolean) => void;
  getClient: (userId: string) => OAuth2Client | null;
  isClientInStore: (userId: string) => boolean;
  hydrateStore: () => Promise<void>;
}

/**
 * Google OAuth Clients PubSub
 */

export type TAuthClientsPubSubAction = "ADD" | "DELETE";
export type TAuthClientsPubSubMessage = {
  action: TAuthClientsPubSubAction;
  userId: string;
};

export interface IGoogleAuthClientsPubSubApi {
  publish: (message: TAuthClientsPubSubMessage) => Promise<void>;
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

export type TStripeUpdatePriceAmountParams = {
  accountId: string;
  priceId: string;
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
  ) => Promise<Stripe.Account>;
  retrieveAccount: (
    params: TStripeRetrieveAccountParams
  ) => Promise<Stripe.Account>;
  createAccountLink: (
    params: TStripeCreateAccountLinkParams
  ) => Promise<Stripe.AccountLink>;
  createProductWithPrice: (
    params: TStripeCreateProductWithPriceParams
  ) => Promise<Stripe.Price>;
  updatePriceAmount: (
    params: TStripeUpdatePriceAmountParams
  ) => Promise<Stripe.Price>;
  createPaymentSession: (
    params: TStripeCreatePaymentSessionParams
  ) => Promise<Stripe.Checkout.Session>;
}

/**
 * Emails Transport
 */

export type TVerifyEmailPayload = {
  username: string;
  userFirstName: string;
};

export type TEventConfirmationPayload = {
  eventId: string;
  eventTypeName: string;
  displayTimezone: string;
  eventDateTime: { start: string; end: string };
  eventLocation: string;
};

export type TEventNotifyUpdatePayload = {
  eventId: string;
  eventTypeName: string;
  eventLocation: string;
  displayTimezone: string;
  pastDateTime: { start: string; end: string };
  newDateTime: { start: string; end: string };
};

export type TTwoFactorAuthPayload = {
  username: string;
  userFirstName: string;
};

export type TSendMailParams =
  | {
      to: string;
      type: "VERIFY_EMAIL";
      payload: TVerifyEmailPayload;
    }
  | {
      to: string;
      type: "EVENT_CONFIRMATION";
      payload: TEventConfirmationPayload;
    }
  | {
      to: string;
      type: "NOTIFY_EVENT_UPDATE";
      payload: TEventNotifyUpdatePayload;
    }
  | {
      to: string;
      type: "TWO_FACTOR_AUTH";
      payload: TTwoFactorAuthPayload;
    };

export type TSendMailType = TSendMailParams["type"];
export type TSendMailPayload = TSendMailParams["payload"];
export type TMailJobData = TSendMailParams;

export interface IMailService {
  sendMail: (params: TSendMailParams) => Promise<void>;
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

export interface GraphQlContext {
  req: Request;
  res: Response;
  services: {
    dbClient: Knex;
    stripeApi: IStripeApi;
    emailApi: IMailService;
    oAuthApi: IGoogleOAuthApi;
    oAuthStoreApi: IGoogleAuthClientsStore;
    googleCalendarApi: IGoogleCalendarApi | null;
  };
}

/**
 * GraphQL API
 */

type TPaginationOrder = "ASC" | "DESC";
export interface PageInfo {
  nextPage: string | null;
  previousPage: string | null;
  take: number;
  order: TPaginationOrder;
}

export interface CursorPaginationParams {
  cursor: string;
  order: TPaginationOrder;
  take: number;
}

export interface EventTypeConnections {
  info: PageInfo;
  edges: EventType[];
}

export interface LocationQl {
  type: TEventTypeLocationType;
  value: string | null;
}

// Event Type Resolvers

export interface AvailableTimeSlot {
  startTime: string;
  endTime: string;
}

export interface AvailableDate {
  date: string;
  times: AvailableTimeSlot[];
}

export interface AvailableDates {
  month: string;
  timezone: string;
  dates: AvailableDate[];
}

export interface AvailableDatesParams {
  month: string;
  timezone: string;
}

export interface SchedulePeriodQl {
  day: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleQl {
  timezone: string;
  periods: SchedulePeriodQl[];
}

export interface QuestionQl {
  type: string;
  label: string;
  isOptional: boolean;
  possibleAnswers: string[] | null;
}

/**
 * ==========================
 * ========= MISC ===========
 * ==========================
 */

export type TDayjsSlot = [Dayjs, Dayjs];
export type TTimeSlotString = [string, string];

export interface ScheduleWithPeriods {
  schedule: Schedule;
  periods: SchedulePeriod[];
}

export interface ReducedPeriod {
  day: number;
  start_time: Dayjs;
  end_time: Dayjs;
}

export interface ReducedSchedule {
  id: string;
  timezone: string;
  periods: ReducedPeriod[];
}
