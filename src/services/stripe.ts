import Stripe from "stripe";
import dayjs from "dayjs";

import logger from "../loaders/logger";
import config from "../config";

import {
  IStripeApi,
  TStripeCreateAccountParams,
  TStripeRetrieveAccountParams,
  TStripeCreateAccountLinkParams,
  TStripeCreateProductWithPriceParams,
  TStripeCreatePaymentSessionParams,
  TStripeConstructWebhookEventParams,
  TStripeArchivePriceAndProductParams,
} from "../types";

const {
  apiKey,
  accountLinkRefreshUri,
  accountLinkReturnUri,
  paymentSuccessUri,
  paymentCancelUri,
} = config.stripe;

const stripe = new Stripe(apiKey, { apiVersion: "2022-11-15" });

const createAccount = async (
  params: TStripeCreateAccountParams
): Promise<Stripe.Account> => {
  try {
    const { firstName, lastName, email, businessType } = params;
    const newAccount: Stripe.Account = await stripe.accounts.create({
      email,
      type: "express",
      business_type: businessType as Stripe.AccountCreateParams.BusinessType,
      ...(businessType === "individual" && {
        individual: { email, first_name: firstName, last_name: lastName },
      }),
      capabilities: {
        card_payments: {
          requested: true,
        },
        transfers: {
          requested: true,
        },
      },
    });
    return newAccount;
  } catch (err) {
    logger.info("An error occured whilst trying to create a stripe account!");
    throw err;
  }
};

const retrieveAccount = async (
  params: TStripeRetrieveAccountParams
): Promise<Stripe.Account> => {
  try {
    const { accountId } = params;
    const account = await stripe.accounts.retrieve(accountId);
    return account;
  } catch (err) {
    logger.info("An error occured whilst trying retrieve a stripe account!");
    throw err;
  }
};

const createAccountLink = async (
  params: TStripeCreateAccountLinkParams
): Promise<Stripe.AccountLink> => {
  try {
    const { accountId } = params;
    const link: Stripe.AccountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${accountLinkRefreshUri}`,
      return_url: `${accountLinkReturnUri}`,
      type: "account_onboarding",
    });
    return link;
  } catch (err) {
    logger.info("An error occured whilst trying to create an account link!");
    throw err;
  }
};

const createProductWithPrice = async (
  params: TStripeCreateProductWithPriceParams
): Promise<Stripe.Price> => {
  try {
    const { productName, unitPrice } = params;
    const productAndPrice = await stripe.prices.create({
      currency: "USD",
      unit_amount: unitPrice * 100,
      product_data: {
        name: productName,
      },
    });
    return productAndPrice;
  } catch (err) {
    logger.info(
      "An error occured whilst trying to create a product with an associated price!"
    );
    throw err;
  }
};

const archivePriceAndProduct = async (
  params: TStripeArchivePriceAndProductParams
): Promise<boolean> => {
  try {
    const { priceId, productId } = params;

    await stripe.prices.update(priceId, { active: false });

    await stripe.products.update(productId, { active: false });

    return true;
  } catch (err) {
    logger.info("An error occured whilst trying to archive the price object");
    throw err;
  }
};

const createPaymentSession = async (
  params: TStripeCreatePaymentSessionParams
): Promise<Stripe.Checkout.Session> => {
  try {
    const { accountId, priceId, eventId, shopperEmail, applicationFee } =
      params;
    const paymentSession = await stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: dayjs().add(30, "minute").unix(),
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee * 100,
        transfer_data: {
          destination: accountId,
        },
        receipt_email: shopperEmail,
      },
      client_reference_id: eventId,
      success_url: `${paymentSuccessUri}`,
      cancel_url: `${paymentCancelUri}`,
    });
    return paymentSession;
  } catch (err) {
    logger.info("An error occured whilst trying to a payment session!");
    throw err;
  }
};

const constructWebhookEvent = (params: TStripeConstructWebhookEventParams) =>
  stripe.webhooks.constructEvent(params.body, params.signature, params.secret);

const stripeApi: IStripeApi = {
  createAccount,
  retrieveAccount,
  createAccountLink,
  createPaymentSession,
  constructWebhookEvent,
  archivePriceAndProduct,
  createProductWithPrice,
};

export default stripeApi;
