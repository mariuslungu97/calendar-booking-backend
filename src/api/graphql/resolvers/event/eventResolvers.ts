import dayjs from "dayjs";
import { GraphQLError } from "graphql";
import { calendar_v3 } from "googleapis";

import { isLoggedIn } from "../../../middleware/auth";
import {
  isDateAvailable,
  handleGraphqlError,
  parsePaginationCursor,
} from "../../../../utils/api";

import { cursorPaginationParamsValidationSchema } from "../validation";
import {
  bookEventParamsValidationSchema,
  cancelEventParamsValidationSchema,
  updateEventTimeParamsValidationSchema,
} from "./eventValidations";

import {
  Event,
  Payment,
  CursorPaginationParams,
  GraphQlContext,
  TUserSessionData,
  PageInfo,
} from "../../../../types";

interface EventAnswer {
  questionId: string;
  answers: string[];
}

interface BookEventCreateInput {
  inviteeEmail: string;
  inviteeFullName: string;
  inviteeTimezone: string;
  startDateTime: string;
  endDateTime: string;
  answers: EventAnswer[];
}

interface BookEventParams {
  username: string;
  eventTypeLink: string;
  params: BookEventCreateInput;
}

interface EventUpdateTimeParams {
  eventId: string;
  params: {
    startDateTime: string;
    endDateTime: string;
  };
}

interface EventDeleteParams {
  eventId: string;
}

interface BookEventResponse {
  message: string;
  redirect?: string;
}

interface EventConnections {
  pageInfo: PageInfo;
  edges: Event[];
}

const eventFields = {
  Event: {
    inviteeEmail: (parent: Event) => parent.invitee_email,
    inviteeFullName: (parent: Event) => parent.invitee_full_name,
    locationValue: (parent: Event) => parent.location_value as string,
    createdAt: (parent: Event) => parent.created_at,
    cancelledAt: (parent: Event) => parent.cancelled_at || null,
    startDateTime: async (
      parent: Event,
      _: any,
      ctx: GraphQlContext
    ): Promise<string> => {
      try {
        const { event_schedule_id } = parent;
        const { dbClient } = ctx.services;

        const eventStartDateTime = (
          await dbClient("event_schedules")
            .select("start_date_time")
            .where("id", event_schedule_id)
        )[0].start_date_time;

        return eventStartDateTime;
      } catch (err) {
        return handleGraphqlError(err, {
          server: "Event.startDateTime resolver error",
          client:
            "Unexpected error trying to retrieve event's start date time!",
        });
      }
    },
    endDateTime: async (
      parent: Event,
      _: any,
      ctx: GraphQlContext
    ): Promise<string> => {
      try {
        const { event_schedule_id } = parent;
        const { dbClient } = ctx.services;

        const eventEndDateTime = (
          await dbClient("event_schedules")
            .select("end_date_time")
            .where("id", event_schedule_id)
        )[0].end_date_time;

        return eventEndDateTime;
      } catch (err) {
        return handleGraphqlError(err, {
          server: "Event.endDateTime resolver error",
          client: "Unexpected error trying to retrieve event's end date time!",
        });
      }
    },
    answers: async (
      parent: Event,
      _: any,
      ctx: GraphQlContext
    ): Promise<EventAnswer[]> => {
      try {
        const { id } = parent;
        const { dbClient } = ctx.services;
        const eventAnswers = await dbClient("event_answers")
          .select("*")
          .where("event_id", id);
        let responseObj = {} as { [id: string]: EventAnswer };

        // group by question_id
        for (const eventAnswer of eventAnswers) {
          const questionId = eventAnswer.question_id;
          if (!(questionId in responseObj)) {
            responseObj[questionId] = {
              questionId,
              answers: [eventAnswer.value],
            };
          } else responseObj[questionId].answers.push(eventAnswer.value);
        }

        return Object.values(responseObj);
      } catch (err) {
        return handleGraphqlError(err, {
          server: "Event.answers resolver error",
          client: "Unexpected error trying to retrieve event answers!",
        });
      }
    },
    payment: async (
      parent: Event,
      _: any,
      ctx: GraphQlContext
    ): Promise<Payment | null> => {
      if (!parent.payment_id) return null;

      try {
        const { dbClient } = ctx.services;
        const payment = (
          await dbClient("payments").select("*").where("id", parent.payment_id)
        )[0];

        return payment;
      } catch (err) {
        return handleGraphqlError(err, {
          server: "Event.payment resolver error",
          client: "Unexpected error trying to retrieve event payment!",
        });
      }
    },
  },
};

const eventQueries = {
  events: async (
    _: any,
    params: CursorPaginationParams,
    ctx: GraphQlContext
  ): Promise<EventConnections> => {
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

      const eventsQuery = dbClient("events")
        .select("*")
        .where("user_id", userId)
        .orderBy("created_at", order)
        .limit(take);

      if (timestamp !== "")
        eventsQuery.andWhere("created_at", operator, timestamp);

      const events = await eventsQuery;

      if (!events.length)
        return {
          pageInfo: { nextPage: null, previousPage: null, order, take },
          edges: [],
        };

      const firstEvent = events[0];
      const lastEvent = events[events.length - 1];

      const prevOperator = order === "DESC" ? ">" : "<";
      const prevEventType = await dbClient("events")
        .select("created_at")
        .where("user_id", userId)
        .andWhere("created_at", prevOperator, firstEvent.created_at)
        .orderBy("created_at", order)
        .limit(1);
      const nextEventType = await dbClient("events")
        .select("created_at")
        .where("user_id", userId)
        .andWhere("created_at", operator, lastEvent.created_at)
        .orderBy("created_at", order)
        .limit(1);

      const pageInfo: PageInfo = {
        nextPage: nextEventType.length
          ? Buffer.from(
              `next__${dayjs(lastEvent.created_at).unix()}`,
              "ascii"
            ).toString("base64")
          : null,
        previousPage: prevEventType.length
          ? Buffer.from(
              `prev__${dayjs(firstEvent.created_at).unix()}`,
              "ascii"
            ).toString("base64")
          : null,
        order,
        take,
      };

      return {
        pageInfo: pageInfo,
        edges: events,
      };
    } catch (err) {
      return handleGraphqlError(err, {
        server: "Event.events resolver error",
        client: "Unexpected error trying to retrieve events!",
      });
    }
  },
};

const eventMutations = {
  bookEvent: async (
    _: any,
    params: BookEventParams,
    ctx: GraphQlContext
  ): Promise<BookEventResponse> => {
    try {
      // validate params
      await bookEventParamsValidationSchema.validateAsync(params);
      const { username, eventTypeLink, params: createParams } = params;
      // validate existence of event type based on username and eventTypeLink
      const { dbClient } = ctx.services;

      const userList = await dbClient("users")
        .select("id", "email", "first_name", "last_name", "stripe_account_id")
        .where("username", username);
      if (!userList.length)
        throw new GraphQLError(
          "There is no event type which can be identified by the provided details!"
        );

      const user = userList[0];

      const eventTypeList = await dbClient("event_types")
        .select("*")
        .where("user_id", user.id)
        .andWhere("link", eventTypeLink);
      if (!eventTypeList.length)
        throw new GraphQLError(
          "There is no event type which can be identified by the provided details!"
        );

      const eventType = eventTypeList[0];

      const eventTypeScheduleTz = (
        await dbClient("schedules")
          .select("timezone")
          .where("id", eventType.schedule_id)
      )[0].timezone;

      const {
        inviteeEmail,
        inviteeFullName,
        inviteeTimezone,
        startDateTime,
        endDateTime,
        answers,
      } = createParams;

      const eventTypeQuestions = await dbClient("event_type_questions")
        .select("*")
        .where("event_type_id", eventType.id);
      const answersQuestionIds = answers.reduce(
        (acc, curr) => ({ ...acc, [curr.questionId]: true }),
        {}
      );
      const mandatoryQuestionIds = eventTypeQuestions.reduce(
        (acc, curr) => !curr.is_optional && { ...acc, [curr.id]: true },
        {}
      );
      const optionalQuestionIds = eventTypeQuestions.reduce(
        (acc, curr) => curr.is_optional && { ...acc, [curr.id]: false },
        {}
      );

      // check if all mandatory questions are answered
      Object.keys(mandatoryQuestionIds).forEach((mandatoryQuestionId) => {
        if (!(mandatoryQuestionId in answersQuestionIds))
          throw new GraphQLError(
            "You have not answered all of the mandatory questions!"
          );
      });

      // check if question ids of provided answers exist
      Object.keys(answersQuestionIds).forEach((answerQuestionId) => {
        if (
          !(answerQuestionId in mandatoryQuestionIds) &&
          !(answerQuestionId in optionalQuestionIds)
        )
          throw new GraphQLError(
            "The id you provided for one answer's associated question does not exist!"
          );
      });

      // check if event with times is available for booking
      if (!isDateAvailable(eventType, [startDateTime, endDateTime]))
        throw new GraphQLError(
          "You cannot book the event at these start and end times!"
        );

      // create event schedule
      const eventSchedule = (
        await dbClient("event_schedules").insert(
          {
            start_date_time: startDateTime,
            end_date_time: endDateTime,
            duration: dayjs(endDateTime).diff(dayjs(startDateTime), "minute"),
          },
          "*"
        )
      )[0];

      // create event
      const event = (
        await dbClient("events").insert(
          {
            payment_id: null,
            user_id: userList[0].id,
            invitee_email: inviteeEmail,
            user_email: userList[0].email,
            invitee_timezone: inviteeTimezone,
            invitee_full_name: inviteeFullName,
            user_timezone: eventTypeScheduleTz,
            event_type_id: eventType.id,
            event_schedule_id: eventSchedule.id,
            status: eventType.collects_payments ? "PENDING_PAYMENT" : "ACTIVE",
            location_value: eventType.location_value || null,
          },
          "*"
        )
      )[0];

      // create event answers
      const eventAnswersFields = answers
        .map((answer) => {
          return answer.answers.map((value) => ({
            event_id: event.id,
            question_id: answer.questionId,
            value,
          }));
        })
        .flat();
      await dbClient("event_answers").insert(eventAnswersFields);

      // create google calendar event if connected to Google
      let googleCalendarEvent: calendar_v3.Schema$Event | null = null;
      const { googleCalendarApi } = ctx.services;
      if (googleCalendarApi) {
        // connected to google; create google calendar event
        googleCalendarEvent = await googleCalendarApi.createEvent({
          startDateTime: eventSchedule.start_date_time,
          endDateTime: eventSchedule.end_date_time,
          attendee: {
            email: event.invitee_email,
            fullName: event.invitee_full_name,
          },
          location: {
            type: eventType.location,
            value: event.location_value || undefined,
          },
          summary: `${eventType.name} between ${event.invitee_full_name} and ${
            user.first_name + " " + user.last_name
          }`,
          description: eventType.description || undefined,
        });
      }

      // create app calendar event

      await dbClient("calendar_events").insert({
        user_id: user.id,
        event_id: event.id,
        event_schedule_id: eventSchedule.id,
        ...(googleCalendarEvent && {
          google_id: googleCalendarEvent.id,
          google_link: googleCalendarEvent.htmlLink,
        }),
      });

      // insert google calendar event generated meets link and insert it into event
      if (eventType.location === "G_MEET" && googleCalendarEvent) {
        await dbClient("events")
          .update({
            location_value: googleCalendarEvent.conferenceData?.conferenceId,
          })
          .where("id", event.id);
      }

      if (eventType.collects_payments) {
        const { stripeApi } = ctx.services;

        const applicationFeeRate =
          (eventType.payment_fee as number) >= 10 ? 0.05 : 0.1;
        const applicationFee =
          (eventType.payment_fee as number) * applicationFeeRate;
        const paymentSession = await stripeApi.createPaymentSession({
          applicationFee,
          accountId: user.stripe_account_id as string,
          priceId: eventType.stripe_price_id as string,
          shopperEmail: event.invitee_email,
          eventId: event.id,
        });

        await dbClient("payments").insert({
          user_id: user.id,
          application_fee: applicationFee,
          stripe_session_id: paymentSession.id,
          stripe_payment_intent_id: paymentSession.payment_intent as string,
          total_fee: (eventType.payment_fee as number) + applicationFee,
          processor_payload: JSON.stringify(paymentSession),
        });

        return {
          message:
            "You must succesfully fulfill the required payment to book the selected event!",
          redirect: paymentSession.url as string,
        };
      } else {
        const { emailApi } = ctx.services;

        emailApi.sendMail({
          to: event.invitee_email,
          type: "EVENT_CONFIRMATION",
          payload: {
            eventId: event.id,
            eventLocation: event.location_value as string,
            eventTypeName: eventType.name,
            displayTimezone: event.invitee_timezone,
            eventDateTime: {
              start: eventSchedule.start_date_time,
              end: eventSchedule.end_date_time,
            },
          },
        });

        return {
          message: "You have succesfully managed to book the event!",
        };
      }
    } catch (err) {
      return handleGraphqlError(err, {
        server: "Event.bookEvent resolver error",
        client: "Unexpected error trying to book an event",
      });
    }
  },
  updateEventTime: async (
    _: any,
    params: EventUpdateTimeParams,
    ctx: GraphQlContext
  ): Promise<Event> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req)) throw new Error("You are not authenticated!");
      const { id: userId } = req.session.user as TUserSessionData;

      await updateEventTimeParamsValidationSchema.validateAsync(params);

      const { dbClient } = ctx.services;
      const { eventId, params: updateTimeParams } = params;
      const { startDateTime, endDateTime } = updateTimeParams;

      const eventList = await dbClient("events")
        .select("*")
        .where("user_id", userId)
        .andWhere("id", eventId);

      if (!eventList.length)
        throw new GraphQLError(
          "You do not have any events with associated id!"
        );

      const event = eventList[0];

      const eventType = (
        await dbClient("event_types")
          .select("*")
          .where("id", event.event_type_id)
      )[0];

      if (!isDateAvailable(eventType, [startDateTime, endDateTime]))
        throw new GraphQLError(
          "The date you provided for event update is not available!"
        );

      const pastDateTimes = (
        await dbClient("event_schedules")
          .select("start_date_time", "end_date_time")
          .where("id", event.event_schedule_id)
      )[0];

      // update time
      await dbClient("event_schedules").update({
        start_date_time: startDateTime,
        end_date_time: endDateTime,
        duration: dayjs(endDateTime).diff(dayjs(startDateTime), "minute"),
      });

      const { emailApi } = ctx.services;
      emailApi.sendMail({
        to: event.invitee_email,
        type: "NOTIFY_EVENT_UPDATE",
        payload: {
          eventId: event.id,
          displayTimezone: event.invitee_timezone,
          eventLocation: event.location_value as string,
          eventTypeName: eventType.name,
          pastDateTime: {
            start: pastDateTimes.start_date_time,
            end: pastDateTimes.end_date_time,
          },
          newDateTime: { start: startDateTime, end: endDateTime },
        },
      });

      return event;
    } catch (err) {
      return handleGraphqlError(err, {
        server: "Event.updateEventTime resolver error",
        client:
          "Unexpected error trying to update an event start and end times",
      });
    }
  },
  cancelEvent: async (
    _: any,
    params: EventDeleteParams,
    ctx: GraphQlContext
  ) => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req)) throw new Error("You are not authenticated!");
      const { id: userId } = req.session.user as TUserSessionData;

      await cancelEventParamsValidationSchema.validateAsync(params);
      const { eventId } = params;

      const { dbClient, emailApi } = ctx.services;

      const eventList = await dbClient("events")
        .select("id")
        .where("id", eventId)
        .andWhere("user_id", userId);
      if (!eventList.length)
        throw new GraphQLError("You have no events with associated id!");

      await dbClient("calendar_events").delete().where("event_id", eventId);

      const cancelledEvent = (
        await dbClient("events")
          .update(
            {
              cancelled_at: Math.round(Date.now() / 1000).toString(),
              status: "CANCELLED",
            },
            "*"
          )
          .where("id", eventId)
      )[0] as Event;
      const cancelledEventSchedule = (
        await dbClient("event_schedules")
          .select("start_date_time", "end_date_time")
          .where("id", cancelledEvent.event_schedule_id)
      )[0];
      const eventTypeName = (
        await dbClient("event_types")
          .select("name")
          .where("id", cancelledEvent.event_type_id)
      )[0].name;
      const userName = (
        await dbClient("users")
          .select("first_name", "last_name")
          .where("id", cancelledEvent.user_id)
      )[0];

      emailApi.sendMail({
        to: cancelledEvent.invitee_email,
        type: "CANCEL_EVENT",
        payload: {
          displayTimezone: cancelledEvent.invitee_timezone,
          eventTypeName,
          userFullName: userName.first_name + " " + userName.last_name,
          eventDateTime: {
            start: cancelledEventSchedule.start_date_time,
            end: cancelledEventSchedule.end_date_time,
          },
        },
      });

      return cancelledEvent;
    } catch (err) {
      return handleGraphqlError(err, {
        server: "Event.cancelEvent resolver error",
        client: "Unexpected error trying to cancel an event",
      });
    }
  },
};

export { eventFields, eventQueries, eventMutations };
