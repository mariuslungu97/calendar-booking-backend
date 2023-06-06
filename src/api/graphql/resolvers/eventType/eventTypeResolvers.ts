import { GraphQLError } from "graphql";
import dayjs from "dayjs";

import {
  areSchedulePeriodsValid,
  retrieveAvailableDates,
  retrieveAvailableTimes,
  handleGraphqlError,
  parsePaginationCursor,
} from "../../../../utils/api";
import { dateToTimezone } from "../../../../utils/schedule";
import { isLoggedIn } from "../../../middleware/auth";
import { cursorPaginationParamsValidationSchema } from "../validation";
import {
  availableDatesParamsValidationSchema,
  availableTimesParamsValidationSchema,
  eventTypeCreateInputValidationSchema,
  eventTypeUpdateParamsValidationSchema,
  eventTypeDeleteParamsValidationSchema,
  eventTypeUpdatePaymentParamsValidationSchema,
  eventTypeScheduleUpdateParamsValidationSchema,
  eventTypeUpdateQuestionsParamsValidationSchema,
} from "./eventTypeValidation";

import {
  EventType,
  PageInfo,
  AvailableDate,
  AvailableDates,
  SchedulePeriodGraphQl,
  CursorPaginationParams,
  GraphQlContext,
  TUserSessionData,
  TEventTypeQuestionType,
  TEventTypeLocationType,
} from "../../../../types";

interface QuestionInput {
  type: TEventTypeQuestionType;
  isOptional: boolean;
  label: string;
  possibleAnswers: string[] | null;
}

interface Question {
  id: string;
  type: TEventTypeQuestionType;
  isOptional: boolean;
  label: string;
  possibleAnswers: string[] | null;
}

interface Location {
  type: TEventTypeLocationType;
  value: string | null;
}

interface Schedule {
  timezone: string;
  periods: SchedulePeriodGraphQl[];
}

interface AvailableDatesParams {
  month: string;
  timezone: string;
}

interface AvailableTimesParams {
  date: string;
  timezone: string;
}

interface EventTypeConnections {
  pageInfo: PageInfo;
  edges: EventType[];
}

interface ViewBookingInformationParams {
  username: string;
  eventTypeLink: string;
}

interface CreateEventTypeInputParams {
  params: {
    name: string;
    link: string;
    duration: number;
    collectsPayments: boolean;
    description?: string;
    paymentFee?: number;
    schedule: Schedule;
    location: Location;
    questions: QuestionInput[];
  };
}

interface UpdateEventTypeParams {
  eventTypeId: string;
  params: {
    name?: string;
    duration?: number;
    description?: string;
    isActive?: boolean;
    location?: Location;
  };
}

interface DeleteEventTypeParams {
  eventTypeId: string;
}

interface UpdateEventTypeScheduleParams {
  eventTypeId: string;
  params: { schedule: Schedule };
}

interface UpdateEventTypeQuestionsParams {
  eventTypeId: string;
  params: { questions: QuestionInput[] };
}

interface UpdateEventTypePaymentParams {
  eventTypeId: string;
  params: {
    collectsPayments: boolean;
    paymentFee?: number;
  };
}

const commonEventTypeFields = {
  paymentFee: (parent: EventType) => parent.payment_fee,
  collectsPayments: (parent: EventType) => parent.collects_payments,
  questions: async (
    parent: EventType,
    _: any,
    ctx: GraphQlContext
  ): Promise<Question[]> => {
    try {
      const { dbClient } = ctx.services;
      const { id } = parent;

      const questions = await dbClient("event_type_questions")
        .select("*")
        .where({ event_type_id: id })
        .orderBy("order", "asc");
      const questionIds = questions.map((question) => question.id);
      const possibleAnswers = await dbClient(
        "event_type_question_possible_answers"
      )
        .select("*")
        .whereIn("question_id", questionIds);

      const questionsWithAnswers: Question[] = questions.map((question) => {
        const questionPossibleAnswers = possibleAnswers
          .filter((answer) => answer.question_id === question.id)
          .map((question) => question.value);

        return {
          id: question.id,
          type: question.type,
          label: question.label,
          isOptional: question.is_optional,
          possibleAnswers:
            question.type === "TEXT" ? null : questionPossibleAnswers,
        };
      });

      return questionsWithAnswers;
    } catch (err) {
      return handleGraphqlError(err, {
        server: "EventType.questions resolver error",
        client: "Unexpected error trying to retrieve event's type questions!",
      });
    }
  },
};

const eventTypeFields = {
  VisitorEventType: {
    ...commonEventTypeFields,
    availableDates: async (
      parent: EventType,
      params: AvailableDatesParams,
      ctx: GraphQlContext
    ): Promise<AvailableDates> => {
      try {
        await availableDatesParamsValidationSchema.validateAsync(params);

        const { month, timezone } = params;

        // validate month to be within this month and 6 months from now
        const monthDate = dayjs(month, "MM-YYYY");
        const visitorCurrentDate = dateToTimezone(dayjs(), timezone);

        if (
          monthDate.isBefore(visitorCurrentDate, "month") ||
          monthDate.isAfter(visitorCurrentDate.add(6, "month"), "month")
        ) {
          throw new GraphQLError(
            "You can only retrieve available dates within the next 6 months!"
          );
        }

        const { dbClient } = ctx.services;
        const { id } = parent;

        const eventType = (await dbClient("event_types").where("id", id))[0];

        const availableDates = await retrieveAvailableDates(
          eventType,
          month,
          timezone
        );
        return availableDates;
      } catch (err) {
        return handleGraphqlError(err, {
          server: "VisitorEventType.availableDates resolver error",
          client:
            "Unexpected error trying to retrieve event's type available dates!",
        });
      }
    },
    availableTimes: async (
      parent: EventType,
      params: AvailableTimesParams,
      ctx: GraphQlContext
    ): Promise<AvailableDate> => {
      try {
        await availableTimesParamsValidationSchema.validateAsync(params);

        const { date, timezone } = params;

        // validate date to be within today's date and a date within 6 months from now
        const dayDate = dayjs(date, "DD-MM-YYYY");
        const visitorCurrentDate = dateToTimezone(dayjs(), timezone);

        if (
          dayDate.isBefore(visitorCurrentDate, "date") ||
          dayDate.isAfter(visitorCurrentDate.add(6, "month"), "date")
        ) {
          throw new GraphQLError(
            "You can only retrieve available dates within the next 6 months!"
          );
        }

        const { dbClient } = ctx.services;
        const { id } = parent;

        const eventType = (await dbClient("event_types").where("id", id))[0];

        const availableTimes = await retrieveAvailableTimes(
          eventType,
          date,
          timezone
        );
        return availableTimes;
      } catch (err) {
        return handleGraphqlError(err, {
          server: "VisitorEventType.availableTimes resolver error",
          client:
            "Unexpected error trying to retrieve event's type available times by date!",
        });
      }
    },
  },
  UserEventType: {
    ...commonEventTypeFields,
    isActive: (parent: EventType) => parent.is_active,
    createdAt: (parent: EventType) => parent.created_at,
    updatedAt: (parent: EventType) => parent.updated_at,
    location: (parent: EventType): Location => ({
      type: parent.location,
      value: parent.location_value || null,
    }),
    schedule: async (
      parent: EventType,
      _: any,
      ctx: GraphQlContext
    ): Promise<Schedule> => {
      try {
        const { dbClient } = ctx.services;

        const eventScheduleList = await dbClient("schedules").where(
          "id",
          parent.schedule_id
        );

        const eventSchedule = eventScheduleList[0];
        const eventSchedulePeriods = await dbClient("schedule_periods")
          .where("schedule_id", eventSchedule.id)
          .orderBy("day", "asc")
          .orderBy("start_time", "asc");

        const scheduleWithPeriods: Schedule = {
          timezone: eventSchedule.timezone,
          periods: eventSchedulePeriods.map(
            (period) =>
              ({
                day: period.day,
                startTime: period.start_time,
                endTime: period.end_time,
              } as SchedulePeriodGraphQl)
          ),
        };

        return scheduleWithPeriods;
      } catch (err) {
        return handleGraphqlError(err, {
          client: "Unexpected error trying to retrieve event's type schedule!",
          server: "UserEventType.schedule resolver error",
        });
      }
    },
  },
};

const eventTypeQueries = {
  eventTypes: async (
    _: any,
    params: CursorPaginationParams,
    ctx: GraphQlContext
  ): Promise<EventTypeConnections> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");

      await cursorPaginationParamsValidationSchema.validateAsync(params);

      const { dbClient } = ctx.services;
      const { id: userId } = req.session.user as TUserSessionData;
      const { cursor, order, take } = params;

      let isNext = true;
      let timestamp = "";
      let operator = "<"; // based on isNext == true && order == "DESC"

      if (cursor !== "") {
        const decodedCursorResponse = parsePaginationCursor(cursor);
        isNext = decodedCursorResponse[0];
        timestamp = decodedCursorResponse[1];
      }

      if (isNext && order === "ASC") operator = ">";
      else if (!isNext && order === "ASC") operator = "<";
      else if (isNext && order === "DESC") operator = "<";
      else if (!isNext && order === "DESC") operator = ">";

      const eventTypesQuery = dbClient("event_types")
        .select("*")
        .where("user_id", userId)
        .orderBy("updated_at", order)
        .limit(take);

      if (timestamp !== "")
        eventTypesQuery.andWhere("updated_at", operator, timestamp);

      const eventTypes = await eventTypesQuery;

      if (!eventTypes.length)
        return {
          pageInfo: { nextPage: null, previousPage: null, order, take },
          edges: [],
        };

      const firstEventType = eventTypes[0];
      const lastEventType = eventTypes[eventTypes.length - 1];

      const prevOperator = order === "DESC" ? ">" : "<";
      const prevEventType = await dbClient("event_types")
        .select("updated_at")
        .where("user_id", userId)
        .andWhere("updated_at", prevOperator, firstEventType.updated_at)
        .orderBy("updated_at", order)
        .limit(1);
      const nextEventType = await dbClient("event_types")
        .select("updated_at")
        .where("user_id", userId)
        .andWhere("updated_at", operator, lastEventType.updated_at)
        .orderBy("updated_at", order)
        .limit(1);

      const pageInfo: PageInfo = {
        nextPage: nextEventType.length
          ? Buffer.from(
              `next__${dayjs(lastEventType.updated_at).unix()}`,
              "ascii"
            ).toString("base64")
          : null,
        previousPage: prevEventType.length
          ? Buffer.from(
              `prev__${dayjs(firstEventType.updated_at).unix()}`,
              "ascii"
            ).toString("base64")
          : null,
        order,
        take,
      };

      return {
        pageInfo: pageInfo,
        edges: eventTypes,
      };
    } catch (err) {
      return handleGraphqlError(err, {
        server: "EventType.eventTypes resolver error",
        client: "Unexpected error trying to retrieve event types!",
      });
    }
  },
  viewBookingInformation: async (
    _: any,
    params: ViewBookingInformationParams,
    ctx: GraphQlContext
  ) => {
    try {
      const { dbClient } = ctx.services;
      const { username, eventTypeLink } = params;

      const userList = await dbClient("users")
        .select("id")
        .where("username", username);
      if (!userList.length)
        throw new GraphQLError("The requested event type couldn't be found!");

      const user = userList[0];
      const eventTypeList = await dbClient("event_types")
        .select("*")
        .where("user_id", user.id)
        .andWhere("link", eventTypeLink);

      if (!eventTypeList.length || !eventTypeList[0].is_active)
        throw new GraphQLError("The requested event type couldn't be found!");

      return eventTypeList[0];
    } catch (err) {
      return handleGraphqlError(err, {
        server: "EventType.viewBookingInformation resolver error",
        client:
          "Unexpected error trying to retrieve an event type booking information!",
      });
    }
  },
};

const eventTypeMutations = {
  createEventType: async (
    _: any,
    params: CreateEventTypeInputParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");
      const { id: userId } = req.session.user as TUserSessionData;

      const { params: createParams } = params;
      await eventTypeCreateInputValidationSchema.validateAsync(createParams);
      const {
        collectsPayments,
        paymentFee,
        schedule,
        name,
        duration,
        location,
        link,
        questions,
        description,
      } = createParams;

      const arePeriodsValid = areSchedulePeriodsValid(schedule.periods);
      if (!arePeriodsValid)
        throw new GraphQLError(
          "The schedule periods you provided are not valid!"
        );

      const { dbClient, stripeApi } = ctx.services;

      if (location.type === "G_MEET") {
        const { oAuthStoreApi } = ctx.services;
        if (!oAuthStoreApi.getClient(userId))
          throw new GraphQLError(
            "You cannot generate Google Meet links for your events without being connected to Google!"
          );
      }

      // check if event type with link for user with id already exists
      const existingEventType = await dbClient("event_types")
        .where("user_id", userId)
        .andWhere("link", link);
      if (existingEventType.length)
        throw new GraphQLError(
          "You already have created an event type with the same link!"
        );

      let stripeProductId: string | null = null;
      let stripePriceId: string | null = null;

      if (collectsPayments) {
        const user = (
          await dbClient("users")
            .select("stripe_account_id")
            .where("id", userId)
        )[0];

        if (!user.stripe_account_id)
          throw new GraphQLError(
            "You must first connect to Stripe before setting up event type payment collection!"
          );

        const stripeAccount = (
          await dbClient("stripe_accounts")
            .select("*")
            .where("id", user.stripe_account_id)
        )[0];

        if (
          !stripeAccount.details_submitted ||
          !stripeAccount.charges_enabled ||
          !stripeAccount.capabilities_enabled
        )
          throw new GraphQLError(
            "You cannot create an event type with payment collection enabled before providing all requested details to Stripe!"
          );

        const stripePrice = await stripeApi.createProductWithPrice({
          accountId: user.stripe_account_id,
          productName: name,
          unitPrice: paymentFee as number,
        });

        stripeProductId = stripePrice.product as string;
        stripePriceId = stripePrice.id;
      }

      // create schedule
      const createdSchedule = (
        await dbClient("schedules").insert(
          { timezone: schedule.timezone, user_id: userId },
          "id"
        )
      )[0];
      // create schedule periods
      const schedulePeriodFields = schedule.periods.map((period) => ({
        schedule_id: createdSchedule.id,
        start_time: period.startTime,
        end_time: period.endTime,
        day: period.day,
      }));
      await dbClient("schedule_periods").insert(schedulePeriodFields);

      const createdEventType = (
        await dbClient("event_types").insert(
          {
            name,
            link,
            duration,
            description,
            user_id: userId,
            location: location.type,
            stripe_price_id: stripePriceId,
            payment_fee: paymentFee || null,
            stripe_product_id: stripeProductId,
            schedule_id: createdSchedule.id,
            collects_payments: collectsPayments,
            location_value: location.type === "G_MEET" ? null : location.value,
          },
          "*"
        )
      )[0];

      // create questions
      const questionFields = questions.map((question, idx) => ({
        event_type_id: createdEventType.id,
        label: question.label,
        is_optional: question.isOptional,
        order: idx,
        type: question.type as TEventTypeQuestionType,
      }));
      const createdQuestions = await dbClient("event_type_questions").insert(
        questionFields,
        "*"
      );

      // create questions potential answers
      const possibleAnswersFields = questions
        .map((question, idx) => {
          const createdQuestionId = createdQuestions[idx].id;

          if (question.possibleAnswers) {
            return question.possibleAnswers.map((possibleAnswer) => ({
              question_id: createdQuestionId,
              value: possibleAnswer,
            }));
          }
        })
        .filter((possibleAnswer) => possibleAnswer !== undefined)
        .flat() as { question_id: string; value: string }[];

      if (possibleAnswersFields.length !== 0)
        await dbClient("event_type_question_possible_answers").insert(
          possibleAnswersFields
        );

      // return event type
      return createdEventType;
    } catch (err) {
      return handleGraphqlError(err, {
        server: "EventType.createEventType resolver error",
        client: "Unexpected error trying to create event type!",
      });
    }
  },
  updateEventType: async (
    _: any,
    params: UpdateEventTypeParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");
      const { id: userId } = req.session.user as TUserSessionData;

      await eventTypeUpdateParamsValidationSchema.validateAsync(params);
      const { eventTypeId, params: updateParams } = params;
      const { name, description, duration, isActive, location } = updateParams;

      const { dbClient } = ctx.services;

      const updatedEventType = await dbClient("event_types")
        .where("id", eventTypeId)
        .andWhere("user_id", userId)
        .update(
          {
            name,
            description,
            duration,
            is_active: isActive,
            ...(location && {
              location: location.type,
              location_value:
                location.type === "G_MEET" ? null : location.value,
            }),
            updated_at: dayjs().toISOString(),
          },
          "*"
        );

      if (!updatedEventType.length)
        throw new GraphQLError("You have no event type with associated id!");

      return updatedEventType[0];
    } catch (err) {
      return handleGraphqlError(err, {
        server: "EventType.updateEventType resolver error",
        client: "Unexpected error trying to update an event type!",
      });
    }
  },
  deleteEventType: async (
    _: any,
    params: DeleteEventTypeParams,
    ctx: GraphQlContext
  ): Promise<String> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");
      const { id: userId } = req.session.user as TUserSessionData;

      await eventTypeDeleteParamsValidationSchema.validateAsync(params);

      const { dbClient } = ctx.services;
      const { eventTypeId } = params;

      const eventTypeList = await dbClient("event_types")
        .select("schedule_id")
        .where("id", eventTypeId)
        .andWhere("user_id", userId);
      if (!eventTypeList.length)
        throw new GraphQLError("You have no event type with associated id!");

      // delete event type questions
      const deletedEventTypeQuestions = await dbClient("event_type_questions")
        .delete("*")
        .where("event_type_id", eventTypeId);
      const questionIds = deletedEventTypeQuestions.map(
        (question) => question.id
      );

      await dbClient("event_type_question_possible_answers")
        .delete()
        .whereIn("question_id", questionIds);

      // delete event type schedule and schedule periods
      await dbClient("schedules")
        .delete()
        .where("id", eventTypeList[0].schedule_id);
      await dbClient("schedule_periods")
        .delete()
        .where("schedule_id", eventTypeList[0].schedule_id);

      // delete event type
      await dbClient("event_types").delete().where("id", eventTypeId);

      return eventTypeId;
    } catch (err) {
      return handleGraphqlError(err, {
        server: "EventType.deleteEventType resolver error",
        client: "Unexpected error trying to delete an event type!",
      });
    }
  },
  updateEventTypeSchedule: async (
    _: any,
    params: UpdateEventTypeScheduleParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");
      const { id: userId } = req.session.user as TUserSessionData;

      await eventTypeScheduleUpdateParamsValidationSchema.validateAsync(params);
      const { eventTypeId, params: updateParams } = params;
      const { schedule } = updateParams;

      const arePeriodsValid = areSchedulePeriodsValid(schedule.periods);
      if (!arePeriodsValid)
        throw new GraphQLError(
          "The schedule periods you provided are not valid!"
        );

      const { dbClient } = ctx.services;

      // check if event type with id belongs to user
      const eventTypeList = await dbClient("event_types")
        .select("*")
        .where("id", eventTypeId)
        .andWhere("user_id", userId);
      if (!eventTypeList.length)
        throw new GraphQLError("You have no event type with associated id!");

      const eventType = eventTypeList[0];
      const eventTypeScheduleId = eventType.schedule_id;

      // delete schedule and associated periods
      await dbClient("schedule_periods")
        .delete()
        .where("schedule_id", eventTypeScheduleId);
      await dbClient("schedules").delete().where("id", eventTypeScheduleId);

      const updatedSchedule = (
        await dbClient("schedules").insert(
          { user_id: userId, timezone: schedule.timezone },
          "id"
        )
      )[0];
      const schedulePeriodFields = schedule.periods.map((period) => ({
        schedule_id: updatedSchedule.id,
        day: period.day,
        start_time: period.startTime,
        end_time: period.endTime,
      }));
      await dbClient("schedule_periods").insert(schedulePeriodFields);

      // update event type schedule foreign key
      await dbClient("event_types")
        .update({
          schedule_id: updatedSchedule.id,
          updated_at: dayjs().toISOString(),
        })
        .where("id", eventTypeId);

      return {
        ...eventType,
        schedule_id: updatedSchedule.id,
      };
    } catch (err) {
      return handleGraphqlError(err, {
        server: "EventType.updateEventTypeSchedule resolver error",
        client: "Unexpected error trying to update an event's type schedule!",
      });
    }
  },
  updateEventTypePayment: async (
    _: any,
    params: UpdateEventTypePaymentParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");
      const { id: userId } = req.session.user as TUserSessionData;

      await eventTypeUpdatePaymentParamsValidationSchema.validateAsync(params);

      const { dbClient, stripeApi } = ctx.services;

      // check if event type with id belongs to user
      const { eventTypeId } = params;
      const existingEventTypeList = await dbClient("event_types")
        .select("id")
        .where("id", eventTypeId)
        .andWhere("user_id", userId);
      if (!existingEventTypeList.length)
        throw new GraphQLError("You have no event type with associated id!");

      // check if user is connected to stripe
      const user = (
        await dbClient("users").select("stripe_account_id").where("id", userId)
      )[0];

      if (!user.stripe_account_id)
        throw new GraphQLError(
          "You cannot make updates to an event type payment options without being connected to Stripe!"
        );

      // check if user has fulfilled all of stripe's info requirements
      const stripeAccount = (
        await dbClient("stripe_accounts")
          .select("*")
          .where("id", user.stripe_account_id)
      )[0];
      if (
        !stripeAccount.capabilities_enabled ||
        !stripeAccount.details_submitted ||
        !stripeAccount.charges_enabled
      )
        throw new GraphQLError(
          "You cannot make updates to an event type payment options without providing all requested information to Stripe!"
        );

      const { params: updateParams } = params;
      const { collectsPayments, paymentFee } = updateParams;

      const eventType = (
        await dbClient("event_types").select("*").where("id", eventTypeId)
      )[0];

      let paymentUpdateFields: Partial<EventType> = {
        collects_payments: collectsPayments,
        payment_fee: paymentFee,
        updated_at: dayjs().toISOString(),
      };

      if (collectsPayments && !eventType.collects_payments) {
        const priceWithProduct = await stripeApi.createProductWithPrice({
          accountId: user.stripe_account_id,
          productName: eventType.name,
          unitPrice: paymentFee as number,
        });

        paymentUpdateFields = {
          ...paymentUpdateFields,
          stripe_product_id: priceWithProduct.product as string,
          stripe_price_id: priceWithProduct.id,
        };
      } else if (collectsPayments && eventType.collects_payments) {
        if (paymentFee !== eventType.payment_fee) {
          // fees differ => update stripe's price unit amount
          await stripeApi.archivePriceAndProduct({
            accountId: user.stripe_account_id,
            priceId: eventType.stripe_price_id as string,
            productId: eventType.stripe_product_id as string,
          });

          const newPriceWithProduct = await stripeApi.createProductWithPrice({
            productName: eventType.name,
            accountId: user.stripe_account_id,
            unitPrice: paymentFee as number,
          });

          paymentUpdateFields = {
            ...paymentUpdateFields,
            stripe_price_id: newPriceWithProduct.id,
            stripe_product_id: newPriceWithProduct.product as string,
          };
        }
      } else if (!collectsPayments && eventType.collects_payments) {
        await stripeApi.archivePriceAndProduct({
          accountId: user.stripe_account_id,
          priceId: eventType.stripe_price_id as string,
          productId: eventType.stripe_product_id as string,
        });

        paymentUpdateFields = {
          ...paymentUpdateFields,
          payment_fee: null,
          stripe_price_id: null,
          stripe_product_id: null,
        };
      }

      const updatedEventType = (
        await dbClient("event_types")
          .update(paymentUpdateFields, "*")
          .where("id", eventTypeId)
      )[0];

      return updatedEventType;
    } catch (err) {
      return handleGraphqlError(err, {
        server: "EventType.updateEventTypePayment resolver error",
        client:
          "Unexpected error trying to update an event type payment options!",
      });
    }
  },
  updateEventTypeQuestions: async (
    _: any,
    params: UpdateEventTypeQuestionsParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");
      const { id: userId } = req.session.user as TUserSessionData;

      await eventTypeUpdateQuestionsParamsValidationSchema.validateAsync(
        params
      );

      const { dbClient } = ctx.services;
      const { eventTypeId, params: updateParams } = params;

      const eventTypeList = await dbClient("event_types")
        .select("id")
        .where("id", eventTypeId)
        .andWhere("user_id", userId);
      if (!eventTypeList.length)
        throw new GraphQLError("You have no event type with associated id!");

      const { questions } = updateParams;

      const eventQuestions = await dbClient("event_type_questions")
        .delete("id")
        .where("event_type_id", eventTypeId);
      const questionIds = eventQuestions.map((q) => q.id);

      // delete questions and potential answers
      await dbClient("event_type_question_possible_answers")
        .delete()
        .whereIn("question_id", questionIds);

      // create questions
      const questionFields = questions.map((question, idx) => ({
        event_type_id: eventTypeId,
        label: question.label,
        is_optional: question.isOptional,
        order: idx,
        type: question.type as TEventTypeQuestionType,
      }));
      const createdQuestions = await dbClient("event_type_questions").insert(
        questionFields,
        "*"
      );

      const possibleAnswersFields = questions
        .map((question, idx) => {
          const createdQuestionId = createdQuestions[idx].id;

          if (question.possibleAnswers) {
            return question.possibleAnswers.map((possibleAnswer) => ({
              question_id: createdQuestionId,
              value: possibleAnswer,
            }));
          }
        })
        .filter((possibleAnswer) => possibleAnswer !== undefined)
        .flat() as { question_id: string; value: string }[];

      if (possibleAnswersFields.length !== 0)
        await dbClient("event_type_question_possible_answers").insert(
          possibleAnswersFields
        );

      const updatedEventType = (
        await dbClient("event_types")
          .update({ updated_at: dayjs().toISOString() }, "*")
          .where("id", eventTypeId)
      )[0];

      return updatedEventType;
    } catch (err) {
      return handleGraphqlError(err, {
        server: "EventType.updateEventTypeQuestions resolver error",
        client: "Unexpected error trying to update an event type questions",
      });
    }
  },
};

export { eventTypeFields, eventTypeQueries, eventTypeMutations };
