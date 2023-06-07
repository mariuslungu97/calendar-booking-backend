import Stripe from "stripe";
import { Request, Response } from "express";
import dayjs from "dayjs";

import config from "../../config";
import knex from "../../loaders/knex";
import mailService from "../../services/mail";
import stripeApi from "../../services/stripe";
import calendarApi from "../../services/googleCalendar";
import googleAuthStore from "../../services/googleAuthClients";

import logger from "../../loaders/logger";

import { Event } from "../../types";

const {
  accountsUpdateWebhook,
  checkoutsSuccessWebhook,
  checkoutsFailureWebhook,
} = config.stripe.secrets;

const accountUpdateEventHandler = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  try {
    const accountUpdateEvent = stripeApi.constructWebhookEvent({
      body: req.body,
      signature: sig,
      secret: accountsUpdateWebhook,
    });

    const updatedAccount = accountUpdateEvent.data.object as Stripe.Account;

    const { id, capabilities, details_submitted, charges_enabled } =
      updatedAccount;

    const existingStripeRecordList = await knex("stripe_accounts")
      .select("capabilities_enabled")
      .where("id", id);
    if (!existingStripeRecordList.length)
      throw new Error(
        "StripeAccount.updated event handler: No stripe db record with received id!"
      );

    const capabilitiesEnabled = capabilities
      ? Object.values(capabilities).every((status) => status === "active")
      : existingStripeRecordList[0].capabilities_enabled;

    await knex("stripe_accounts")
      .update({
        details_submitted,
        charges_enabled,
        capabilities_enabled: capabilitiesEnabled,
        updated_at: dayjs().toISOString(),
      })
      .where("id", id);

    res.status(200).json({});
  } catch (err) {
    logger.info("Encountered Stripe account update event error!");
    logger.info(err);
    res.status(400).send(`Webhook Error: ${(err as any).message}`);
    return;
  }
};

const checkoutSessionCompletedEventHandler = async (
  req: Request,
  res: Response
) => {
  const sig = req.headers["stripe-signature"] as string;

  try {
    const sessionCompletedEvent = stripeApi.constructWebhookEvent({
      body: req.body,
      signature: sig,
      secret: checkoutsSuccessWebhook,
    });

    const session = sessionCompletedEvent.data
      .object as Stripe.Checkout.Session;

    const { id } = session;
    const paymentRecordList = await knex("payments")
      .select("id")
      .where("stripe_session_id", id);
    if (!paymentRecordList.length)
      throw new Error(
        "CheckoutSession.completed: No payment record with associated session id"
      );

    // update payment record
    await knex("payments")
      .update({
        status: "SUCCESS",
        stripe_payment_intent_id: session.payment_intent as string,
        processor_payload: JSON.stringify(session),
        updated_at: dayjs().toISOString(),
      })
      .where("stripe_session_id", id);

    // update event
    const event = (
      await knex("events")
        .update(
          {
            status: "ACTIVE",
          },
          "*"
        )
        .where("payment_id", paymentRecordList[0].id)
    )[0] as Event;
    const eventSchedule = (
      await knex("event_schedules")
        .select("start_date_time", "end_date_time")
        .where("id", event.event_schedule_id)
    )[0];
    const eventTypeName = (
      await knex("event_types").select("name").where("id", event.event_type_id)
    )[0].name;

    // send confirmation mail
    mailService.sendMail({
      to: event.invitee_email,
      type: "EVENT_CONFIRMATION",
      payload: {
        eventTypeName,
        eventId: event.id,
        eventLocation: event.location_value as string,
        displayTimezone: event.invitee_timezone,
        eventDateTime: {
          start: eventSchedule.start_date_time,
          end: eventSchedule.end_date_time,
        },
      },
    });

    res.status(200).json({});
  } catch (err) {
    res.status(400).send(`Webhook Error: ${(err as any).message}`);
    return;
  }
};

const checkoutSessionExpiredEventHandler = async (
  req: Request,
  res: Response
) => {
  const sig = req.headers["stripe-signature"] as string;

  try {
    const sessionExpiredEvent = stripeApi.constructWebhookEvent({
      body: req.body,
      signature: sig,
      secret: checkoutsFailureWebhook,
    });

    const session = sessionExpiredEvent.data.object as Stripe.Checkout.Session;

    const { id } = session;
    const paymentRecordList = await knex("payments")
      .select("id")
      .where("stripe_session_id", id);
    if (!paymentRecordList.length)
      throw new Error(
        "CheckoutSession.expired: No payment record with associated session id"
      );

    // update payment
    await knex("payments")
      .update({
        status: "FAIL",
        updated_at: dayjs().toISOString(),
        processor_payload: JSON.stringify(session),
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .where("id", paymentRecordList[0].id);

    // update event
    const updatedEvent = (
      await knex("events")
        .update({ status: "FAILED_PAYMENT" }, "*")
        .where("payment_id", paymentRecordList[0].id)
    )[0] as Event;

    const calendarEventGoogleId = (
      await knex("calendar_events")
        .select("google_id")
        .where("event_id", updatedEvent.id)
    )[0].google_id;

    // delete calendar event
    await knex("calendar_events").delete().where("event_id", updatedEvent.id);

    if (calendarEventGoogleId) {
      // delete google calendar event
      const userId = (
        await knex("users").select("id").where("id", updatedEvent.user_id)
      )[0].id;
      const authClient = googleAuthStore.getClient(userId);
      if (authClient) {
        const { deleteEvent } = calendarApi(authClient);
        deleteEvent(calendarEventGoogleId);
      }
    }

    res.status(200).json({});
  } catch (err) {
    res.status(400).send(`Webhook Error: ${(err as any).message}`);
    return;
  }
};

export {
  accountUpdateEventHandler,
  checkoutSessionExpiredEventHandler,
  checkoutSessionCompletedEventHandler,
};
