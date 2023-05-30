import Stripe from "stripe";
import { Request, Response } from "express";

import knex from "../../loaders/knex";
import mailService from "../../services/mail";
import stripeApi from "../../services/stripe";

import { Event } from "../../types";

const accountUpdateEventHandler = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  try {
    const accountUpdateEvent = stripeApi.constructWebhookEvent({
      body: req.body,
      signature: sig,
    });

    res.status(200).json({});

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
      ? Object.values(capabilities).every((status) => status === true)
      : existingStripeRecordList[0].capabilities_enabled;

    await knex("stripe_accounts")
      .update({
        details_submitted,
        charges_enabled,
        capabilities_enabled: capabilitiesEnabled,
        updated_at: Date.now().toString(),
      })
      .where("id", id);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${(err as any).message}`);
    return;
  }
};

const checkoutSessionSuccessEventHandler = async (
  req: Request,
  res: Response
) => {
  const sig = req.headers["stripe-signature"] as string;

  try {
    const sessionSuccessEvent = stripeApi.constructWebhookEvent({
      body: req.body,
      signature: sig,
    });

    res.status(200).json({});

    const session = sessionSuccessEvent.data.object as Stripe.Checkout.Session;

    const { id } = session;
    const paymentRecordList = await knex("payments")
      .select("id")
      .where("stripe_session_id", id);
    if (!paymentRecordList.length)
      throw new Error(
        "CheckoutSession.async_payment_succeeded: No payment record with associated session id"
      );

    // update payment record
    await knex("payments")
      .update({
        status: "SUCCESS",
        processor_payload: JSON.stringify(session),
        updated_at: Date.now().toString(),
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
  } catch (err) {
    res.status(400).send(`Webhook Error: ${(err as any).message}`);
    return;
  }
};

const checkoutSessionFailureEventHandler = async (
  req: Request,
  res: Response
) => {
  const sig = req.headers["stripe-signature"] as string;

  try {
    const sessionFailureEvent = stripeApi.constructWebhookEvent({
      body: req.body,
      signature: sig,
    });

    res.status(200).json({});

    const session = sessionFailureEvent.data.object as Stripe.Checkout.Session;

    const { id } = session;
    const paymentRecordList = await knex("payments")
      .select("id")
      .where("stripe_session_id", id);
    if (!paymentRecordList.length)
      throw new Error(
        "CheckoutSession.async_payment_failed: No payment record with associated session id"
      );

    // update payment
    await knex("payments")
      .update({
        status: "FAIL",
        updated_at: Date.now().toString(),
        processor_payload: JSON.stringify(session),
      })
      .where("id", paymentRecordList[0].id);

    // update event
    const updatedEvent = (
      await knex("events")
        .update({ status: "FAILED_PAYMENT" }, "*")
        .where("payment_id", paymentRecordList[0].id)
    )[0] as Event;

    // delete calendar event
    await knex("calendar_events").delete().where("event_id", updatedEvent.id);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${(err as any).message}`);
    return;
  }
};

export {
  accountUpdateEventHandler,
  checkoutSessionFailureEventHandler,
  checkoutSessionSuccessEventHandler,
};
