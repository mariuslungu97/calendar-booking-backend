import { Knex } from "knex";

import {
  User,
  OAuthConnection,
  Schedule,
  SchedulePeriod,
  EventType,
  EventTypeQuestion,
  EventTypeQuestionPossibleAnswer,
  CalendarEvent,
  Payment,
  EventSchedule,
  TEventScheduleCreateInput,
  TEventScheduleUpdateParams,
  Event,
  EventAnswer,
  TEventAnswerCreateInput,
  TEventAnswerUpdateParams,
  TCalendarEventCreateInput,
  TCalendarEventUpdateParams,
  TPaymentCreateInput,
  TPaymentUpdateParams,
  TEventCreateInput,
  TEventUpdateParams,
  TUserCreateInput,
  TUserUpdateParams,
  TOAuthConnectionCreateInput,
  TOAuthConnectionUpdateParams,
  TScheduleCreateInput,
  TScheduleUpdateParams,
  TSchedulePeriodCreateInput,
  TSchedulePeriodUpdateParams,
  TEventTypeCreateInput,
  TEventTypeUpdateParams,
  TEventTypeQuestionCreateInput,
  TEventTypeQuestionUpdateParams,
  TEventTypeQuestionPossibleAnswerCreateInput,
  TEventTypeQuestionPossibleAnswerUpdateParams,
} from "../types";

declare module "knex/types/tables" {
  interface Tables {
    users: Knex.CompositeTableType<User, TUserCreateInput, TUserUpdateParams>;

    oauth_connections: Knex.CompositeTableType<
      OAuthConnection,
      TOAuthConnectionCreateInput,
      TOAuthConnectionUpdateParams
    >;

    schedules: Knex.CompositeTableType<
      Schedule,
      TScheduleCreateInput,
      TScheduleUpdateParams
    >;

    schedule_periods: Knex.CompositeTableType<
      SchedulePeriod,
      TSchedulePeriodCreateInput,
      TSchedulePeriodUpdateParams
    >;

    event_types: Knex.CompositeTableType<
      EventType,
      TEventTypeCreateInput,
      TEventTypeUpdateParams
    >;

    event_type_questions: Knex.CompositeTableType<
      EventTypeQuestion,
      TEventTypeQuestionCreateInput,
      TEventTypeQuestionUpdateParams
    >;

    event_type_question_possible_answers: Knex.CompositeTableType<
      EventTypeQuestionPossibleAnswer,
      TEventTypeQuestionPossibleAnswerCreateInput,
      TEventTypeQuestionPossibleAnswerUpdateParams
    >;

    event_schedules: Knex.CompositeTableType<
      EventSchedule,
      TEventScheduleCreateInput,
      TEventScheduleUpdateParams
    >;

    calendar_events: Knex.CompositeTableType<
      CalendarEvent,
      TCalendarEventCreateInput,
      TCalendarEventUpdateParams
    >;

    payments: Knex.CompositeTableType<
      Payment,
      TPaymentCreateInput,
      TPaymentUpdateParams
    >;

    events: Knex.CompositeTableType<
      Event,
      TEventCreateInput,
      TEventUpdateParams
    >;

    event_answers: Knex.CompositeTableType<
      EventAnswer,
      TEventAnswerCreateInput,
      TEventAnswerUpdateParams
    >;
  }
}
