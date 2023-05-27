import { GraphQLError } from "graphql";
import { ValidationError } from "joi";
import dayjs from "dayjs";

import logger from "../../../../loaders/logger";

import { retrieveMonthSlots } from "../../../../utils/api";
import { dateToTimezone } from "../../../../utils/schedule";
import {
  availableDatesParamsValidationSchema,
  eventTypeCreateInputValidationSchema,
  eventTypeUpdateParamsValidationSchema,
  eventTypeUpdatePaymentParamsValidationSchema,
  eventTypeScheduleUpdateParamsValidationSchema,
  eventTypeUpdateQuestionsParamsValidationSchema,
} from "./eventTypeValidation";

import {
  EventType,
  ScheduleQl,
  AvailableDatesParams,
  QuestionQl,
  PageInfo,
  EventTypeConnections,
  CursorPaginationParams,
  GraphQlContext,
  AvailableDates,
  TUserSessionData,
  SchedulePeriodQl,
  LocationQl,
  TEventTypeQuestionType,
} from "../../../../types";
import { isLoggedIn } from "../../../middleware/auth";

interface EventTypeCreateInputParams {
  name: string;
  link: string;
  duration: number;
  collectsPayments: boolean;
  description?: string;
  paymentFee?: number;
  questions: QuestionQl[];
  schedule: ScheduleQl;
  location: LocationQl;
}

interface EventTypeUpdateInputParams {
  eventTypeId: string;
  params: {
    name?: string;
    duration?: number;
    description?: string;
    isActive?: boolean;
    location?: LocationQl;
  };
}

interface EventTypeDeleteParams {
  eventTypeId: string;
}

interface EventTypeScheduleUpdateParams {
  eventTypeId: string;
  params: { schedule: ScheduleQl };
}

interface EventTypeUpdatePaymentParams {
  eventTypeId: string;
  params: {
    collectsPayments: boolean;
    paymentFee?: number;
  };
}

interface EventTypeUpdateQuestionsParams {
  eventTypeId: string;
  params: {
    questions: QuestionQl[];
  };
}

const commonEventTypeFields = {
  paymentFee: (parent: EventType) => parent.payment_fee,
  collectsPayments: (parent: EventType) => parent.collects_payments,
  questions: async (
    parent: EventType,
    _: any,
    ctx: GraphQlContext
  ): Promise<QuestionQl[]> => {
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

      const questionsWithAnswers: QuestionQl[] = questions.map((question) => {
        const answerValues = [];
        for (const answer of possibleAnswers) {
          if (question.type === "TEXT") break;

          if (answer.question_id === question.id)
            answerValues.push(answer.value);
        }

        return {
          type: question.type,
          label: question.label,
          isOptional: question.is_optional,
          possibleAnswers: question.type === "TEXT" ? null : answerValues,
        };
      });

      return questionsWithAnswers;
    } catch (err) {
      logger.error("Questions Event Type Resolver Error: ", err);
      throw new GraphQLError(
        "Unexpected error trying to retrieve event type questions!"
      );
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
          monthDate.isAfter(visitorCurrentDate.add(6, "month"))
        ) {
          throw new GraphQLError(
            "You can only retrieve available dates within the next 6 months!"
          );
        }

        const { dbClient } = ctx.services;
        const { id } = parent;

        const eventTypeList = await dbClient("event_types").where("id", id);
        if (!eventTypeList.length)
          throw new GraphQLError(
            "Unexpected error trying to retrieve event type's available dates!"
          );

        const availableDates = await retrieveMonthSlots(
          eventTypeList[0],
          month,
          timezone
        );
        if (!availableDates)
          throw new GraphQLError(
            "Unexpected error trying to retrieve event type's available dates!"
          );

        return availableDates;
      } catch (err) {
        if (err instanceof ValidationError) {
          const { details } = err;
          const messages = details.reduce(
            (prev, detail) => (prev += detail.message + " "),
            ""
          );
          throw new GraphQLError(messages);
        }
        logger.error("Event Type Available Dates Resolver Error: ", err);
        throw new GraphQLError(
          "Unexpected error trying to retrieve event type's available dates!"
        );
      }
    },
  },
  EventType: {
    ...commonEventTypeFields,
    isActive: (parent: EventType) => parent.is_active,
    location: (parent: EventType): LocationQl => ({
      type: parent.location,
      value: parent.location_value || null,
    }),
    schedule: async (
      parent: EventType,
      _: any,
      ctx: GraphQlContext
    ): Promise<ScheduleQl> => {
      try {
        const { dbClient } = ctx.services;

        const eventScheduleList = await dbClient("schedules").where(
          "id",
          parent.schedule_id
        );

        const eventSchedule = eventScheduleList[0];
        const eventSchedulePeriods = await dbClient("schedule_periods").where(
          "schedule_id",
          eventSchedule.id
        );

        const scheduleWithPeriods: ScheduleQl = {
          timezone: eventSchedule.timezone,
          periods: eventSchedulePeriods.map(
            (period) =>
              ({
                day: period.day,
                startTime: period.start_time,
                endTime: period.end_time,
              } as SchedulePeriodQl)
          ),
        };

        return scheduleWithPeriods;
      } catch (err) {
        logger.error("Event Type Schedule Resolver Error: ", err);
        throw new GraphQLError(
          "Unexpected error trying to retrieve event type's schedule!"
        );
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
    const { req } = ctx;

    if (!isLoggedIn(req)) throw new GraphQLError("You are not authenticated!");

    try {
      const { dbClient } = ctx.services;
      const { id } = req.session.user as TUserSessionData;
      const { cursor, order, take } = params;

      const decodedCursor = Buffer.from(cursor, "base64").toString("ascii");
      const isNext = decodedCursor.split("__")[0];
      const operator = isNext ? ">" : "<";
      const timestamp = decodedCursor.split("__")[1];
      // reverse orders if we're going back
      const updatedOrder = isNext ? order : order === "DESC" ? "ASC" : "DESC";
      const eventTypes = await dbClient("event_types")
        .where("id", id)
        .andWhere("updated_at", operator, timestamp)
        .orderBy("updated_at", updatedOrder)
        .limit(take);

      if (!eventTypes.length)
        return {
          info: { nextPage: null, previousPage: null, order, take },
          edges: [],
        };

      const firstEventType = eventTypes[0];
      const lastEventType = eventTypes[eventTypes.length - 1];

      const prevEventType = await dbClient("event_types")
        .where("id", id)
        .andWhere("updated_at", operator, firstEventType.updated_at)
        .orderBy("updated_at", updatedOrder)
        .limit(1);
      const nextEventType = await dbClient("event_types")
        .where("id", id)
        .andWhere("updated_at", operator, lastEventType.updated_at)
        .orderBy("updated_at", updatedOrder)
        .limit(1);

      const pageInfo: PageInfo = {
        nextPage: nextEventType.length
          ? Buffer.from(
              `next__${nextEventType[0].updated_at}`,
              "ascii"
            ).toString("base64")
          : null,
        previousPage: prevEventType.length
          ? Buffer.from(
              `prev__${prevEventType[0].updated_at}`,
              "ascii"
            ).toString("base64")
          : null,
        order,
        take,
      };

      return {
        info: pageInfo,
        edges: eventTypes,
      };
    } catch (err) {
      logger.error("Event Types Resolver Error: ", err);
      throw new GraphQLError(
        "Unexpected error trying to retrieve event types "
      );
    }
  },
};

const eventTypeMutations = {
  createEventType: async (
    _: any,
    params: EventTypeCreateInputParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { dbClient, stripeApi } = ctx.services;
      const { req } = ctx;

      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");

      await eventTypeCreateInputValidationSchema.validateAsync(params);

      const { id: userId } = req.session.user as TUserSessionData;

      // check if event type with link for user with id already exists
      const existingEventType = await dbClient("event_types")
        .where("user_id", userId)
        .andWhere("link", params.link);
      if (existingEventType.length)
        throw new GraphQLError(
          "You already have created an event type with the same link!"
        );

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
      } = params;

      let stripeAccountId: string | null | undefined;
      if (collectsPayments) {
        const userList = await dbClient("users")
          .select("stripe_account_id")
          .where("id", userId);
        stripeAccountId = userList[0].stripe_account_id;
        if (!stripeAccountId)
          throw new GraphQLError(
            "You must first connect to Stripe before setting up event type payment collection!"
          );
      }

      // create schedule
      const createdSchedule = await dbClient("schedules").insert(
        { timezone: schedule.timezone, user_id: userId },
        "*"
      );
      // create schedule periods
      const schedulePeriods = schedule.periods.map((period) => ({
        schedule_id: createdSchedule[0].id,
        start_time: period.startTime,
        end_time: period.endTime,
        day: period.day,
      }));
      await dbClient("schedule_periods").insert(schedulePeriods);

      // create product and price stripe ids if user is stripe connected and params.collectsPayments == true
      // create event type
      let stripeProductId: string | null = null;
      let stripePriceId: string | null = null;
      if (stripeAccountId) {
        const stripePrice = await stripeApi.createProductWithPrice({
          accountId: stripeAccountId,
          productName: name,
          unitPrice: paymentFee as number,
        });
        if (!stripePrice)
          throw new GraphQLError(
            "Unexpected error trying to create event type with payment!"
          );
        stripeProductId = stripePrice.product as string;
        stripePriceId = stripePrice.id;
      }

      const createdEventType = await dbClient("event_types").insert(
        {
          name,
          link,
          duration,
          description,
          user_id: userId,
          location: location.type,
          location_value: location.value,
          stripe_price_id: stripePriceId,
          stripe_product_id: stripeProductId,
          schedule_id: createdSchedule[0].id,
          collects_payments: collectsPayments,
        },
        "*"
      );

      // create questions
      const eventTypeQuestions = questions.map((question, idx) => ({
        event_type_id: createdEventType[0].id,
        label: question.label,
        is_optional: question.isOptional,
        order: idx,
        type: question.type as TEventTypeQuestionType,
      }));
      const createdQuestions = await dbClient("event_type_questions").insert(
        eventTypeQuestions,
        "*"
      );

      // create questions potential answers
      const eventTypeQuestionsPotentialAnswers = questions
        .map((question, idx) => {
          const createdQuestion = createdQuestions.find(
            (cQuestion) =>
              cQuestion.label === question.label && cQuestion.order === idx
          );

          if (createdQuestion && question.possibleAnswers) {
            return question.possibleAnswers.map((possibleAnswer) => ({
              question_id: createdQuestion.id,
              value: possibleAnswer,
            }));
          }
        })
        .filter((possibleAnswer) => possibleAnswer !== undefined)
        .flat() as { question_id: string; value: string }[];

      await dbClient("event_type_question_possible_answers").insert(
        eventTypeQuestionsPotentialAnswers
      );

      // return event type
      return createdEventType[0];
    } catch (err) {
      if (err instanceof ValidationError) {
        const { details } = err;
        const messages = details.reduce(
          (prev, detail) => (prev += detail.message + " "),
          ""
        );
        throw new GraphQLError(messages);
      }
      logger.error("Event Type Create Resolver Error: ", err);
      throw new GraphQLError(
        "Unexpected error trying to create an event type!"
      );
    }
  },
  updateEventType: async (
    _: any,
    params: EventTypeUpdateInputParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");

      await eventTypeUpdateParamsValidationSchema.validateAsync(params);

      const { dbClient } = ctx.services;
      const { eventTypeId, params: updateParams } = params;
      const { name, description, duration, isActive, location } = updateParams;

      const updatedEventType = await dbClient("event_types")
        .where("id", eventTypeId)
        .update(
          {
            name,
            description,
            duration,
            is_active: isActive,
            ...(location && {
              location: location.type,
              location_value: location.value,
            }),
          },
          "*"
        );

      return updatedEventType[0];
    } catch (err) {
      if (err instanceof ValidationError) {
        const { details } = err;
        const messages = details.reduce(
          (prev, detail) => (prev += detail.message + " "),
          ""
        );
        throw new GraphQLError(messages);
      }
      logger.error("Event Type Update Error: ", err);
      throw new GraphQLError(
        "Unexpected error trying to update an event type!"
      );
    }
  },
  deleteEventType: async (
    _: any,
    params: EventTypeDeleteParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");

      const { dbClient } = ctx.services;
      const { eventTypeId } = params;

      const deletedEventType = await dbClient("event_types")
        .delete("*")
        .where("id", eventTypeId);

      return deletedEventType[0];
    } catch (err) {
      logger.error("Event Type Delete Error: ", err);
      throw new GraphQLError(
        "Unexpected error trying to delete an event type!"
      );
    }
  },
  updateEventTypeSchedule: async (
    _: any,
    params: EventTypeScheduleUpdateParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");

      await eventTypeScheduleUpdateParamsValidationSchema.validateAsync(params);

      const { id: userId } = req.session.user as TUserSessionData;
      const { dbClient } = ctx.services;
      const { eventTypeId, params: updateParams } = params;
      const { schedule } = updateParams;

      // delete the schedule with its associated periods
      const eventType = (
        await dbClient("event_types").select("*").where("id", eventTypeId)
      )[0];
      const eventTypeScheduleId = eventType.schedule_id;
      await dbClient("schedule_periods")
        .delete()
        .where("schedule_id", eventTypeScheduleId);
      await dbClient("schedules").delete().where("id", eventTypeScheduleId);

      // create a new schedule and periods
      const updatedSchedule = (
        await dbClient("schedules").insert(
          { user_id: userId, timezone: schedule.timezone },
          "id"
        )
      )[0];
      const schedulePeriods = schedule.periods.map((period) => ({
        schedule_id: updatedSchedule.id,
        day: period.day,
        start_time: period.startTime,
        end_time: period.endTime,
      }));
      await dbClient("schedule_periods").insert(schedulePeriods);

      // update event type schedule foreign key
      await dbClient("event_types")
        .update({ schedule_id: updatedSchedule.id })
        .where("id", eventTypeId);

      return {
        ...eventType,
        schedule_id: updatedSchedule.id,
      };
    } catch (err) {
      if (err instanceof ValidationError) {
        const { details } = err;
        const messages = details.reduce(
          (prev, detail) => (prev += detail.message + " "),
          ""
        );
        throw new GraphQLError(messages);
      }
      logger.error("Event Type Update Schedule Error: ", err);
      throw new GraphQLError(
        "Unexpected error trying to update an event's type schedule!"
      );
    }
  },
  updateEventTypePayment: async (
    _: any,
    params: EventTypeUpdatePaymentParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");

      await eventTypeUpdatePaymentParamsValidationSchema.validateAsync(params);

      const { id: userId } = req.session.user as TUserSessionData;
      const { dbClient, stripeApi } = ctx.services;
      const { eventTypeId, params: updateParams } = params;
      const { collectsPayments, paymentFee } = updateParams;

      const eventType = (
        await dbClient("event_types").select("*").where("id", eventTypeId)
      )[0];
      const userAccount = (
        await dbClient("users").select("stripe_account_id").where("id", userId)
      )[0];

      let paymentUpdateFields: Partial<EventType> = {
        collects_payments: collectsPayments,
        payment_fee: paymentFee,
      };

      if (collectsPayments && !eventType.collects_payments) {
        if (!userAccount.stripe_account_id)
          throw new GraphQLError(
            "You cannot toggle payments for a given event type without being connected to Stripe!"
          );

        const priceWithProduct = await stripeApi.createProductWithPrice({
          accountId: userAccount.stripe_account_id,
          productName: eventType.name,
          unitPrice: paymentFee as number,
        });
        if (!priceWithProduct)
          throw new GraphQLError(
            "Unexpected error trying to toggle payment for a given event type!"
          );

        paymentUpdateFields = {
          ...paymentUpdateFields,
          stripe_product_id: priceWithProduct.product as string,
          stripe_price_id: priceWithProduct.id,
        };
      } else if (collectsPayments && eventType.collects_payments) {
        if (
          paymentFee !== eventType.payment_fee &&
          userAccount.stripe_account_id &&
          eventType.stripe_price_id
        ) {
          // fees differ => update stripe's price unit amount
          await stripeApi.updatePriceAmount({
            accountId: userAccount.stripe_account_id,
            priceId: eventType.stripe_price_id,
            unitPrice: paymentFee as number,
          });
        }
      } else if (!collectsPayments && eventType.collects_payments) {
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
      if (err instanceof ValidationError) {
        const { details } = err;
        const messages = details.reduce(
          (prev, detail) => (prev += detail.message + " "),
          ""
        );
        throw new GraphQLError(messages);
      }
      logger.error("Event Type Update Payment Error: ", err);
      throw new GraphQLError(
        "Unexpected error trying to update an event's type payment!"
      );
    }
  },
  updateEventTypeQuestions: async (
    _: any,
    params: EventTypeUpdateQuestionsParams,
    ctx: GraphQlContext
  ): Promise<EventType> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");

      await eventTypeUpdateQuestionsParamsValidationSchema.validateAsync(
        params
      );

      const { dbClient } = ctx.services;
      const { eventTypeId, params: updateParams } = params;
      const { questions } = updateParams;

      const eventQuestions = await dbClient("event_type_questions")
        .select("id")
        .where("event_type_id", eventTypeId);
      const questionIds = eventQuestions.map((q) => q.id);

      // delete questions and potential answers
      await dbClient("event_type_question_possible_answers")
        .delete()
        .whereIn("question_id", questionIds);
      await dbClient("event_type_questions")
        .delete()
        .whereIn("id", questionIds);

      // create questions
      const eventTypeQuestions = questions.map((question, idx) => ({
        event_type_id: eventTypeId,
        label: question.label,
        is_optional: question.isOptional,
        order: idx,
        type: question.type as TEventTypeQuestionType,
      }));
      const createdQuestions = await dbClient("event_type_questions").insert(
        eventTypeQuestions,
        "*"
      );

      // create questions potential answers
      const eventTypeQuestionsPotentialAnswers = questions
        .map((question, idx) => {
          const createdQuestion = createdQuestions.find(
            (cQuestion) =>
              cQuestion.label === question.label && cQuestion.order === idx
          );

          if (createdQuestion && question.possibleAnswers) {
            return question.possibleAnswers.map((possibleAnswer) => ({
              question_id: createdQuestion.id,
              value: possibleAnswer,
            }));
          }
        })
        .filter((possibleAnswer) => possibleAnswer !== undefined)
        .flat() as { question_id: string; value: string }[];

      await dbClient("event_type_question_possible_answers").insert(
        eventTypeQuestionsPotentialAnswers
      );

      const updatedEventType = (
        await dbClient("event_types").select("*").where("id", eventTypeId)
      )[0];

      return updatedEventType;
    } catch (err) {
      if (err instanceof ValidationError) {
        const { details } = err;
        const messages = details.reduce(
          (prev, detail) => (prev += detail.message + " "),
          ""
        );
        throw new GraphQLError(messages);
      }
      logger.error("Event Type Update Questions Error: ", err);
      throw new GraphQLError(
        "Unexpected error trying to update an event's type questions!"
      );
    }
  },
};

export { eventTypeFields, eventTypeQueries, eventTypeMutations };
