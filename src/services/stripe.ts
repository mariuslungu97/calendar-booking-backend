import Stripe from "stripe";

import logger from "../loaders/logger";
import config from "../config";

import {
  IStripeApi,
  TStripeCreateAccountParams,
  TStripeCreateAccountLinkParams,
  TStripeCreateProductWithPriceParams,
  TStripeCreatePaymentSessionParams,
} from "../types";

const { uri } = config.app;
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
): Promise<Stripe.Account | null> => {
  try {
    const { firstName, lastName, email } = params;
    const newAccount: Stripe.Account = await stripe.accounts.create({
      email,
      individual: {
        email,
        first_name: firstName,
        last_name: lastName,
      },
    });
    return newAccount;
  } catch (err) {
    logger.info(
      "An error occured whilst trying to create a stripe account!",
      err
    );
    return null;
  }
};

const createAccountLink = async (
  params: TStripeCreateAccountLinkParams
): Promise<Stripe.AccountLink | null> => {
  try {
    const { accountId } = params;
    const link: Stripe.AccountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${uri}${accountLinkRefreshUri}`,
      return_url: `${uri}${accountLinkReturnUri}`,
      type: "account_onboarding",
    });
    return link;
  } catch (err) {
    logger.info(
      "An error occured whilst trying to create an account link!",
      err
    );
    return null;
  }
};

const createProductWithPrice = async (
  params: TStripeCreateProductWithPriceParams
): Promise<Stripe.Price | null> => {
  try {
    const { productName, unitPrice } = params;
    const productAndPrice = await stripe.prices.create({
      currency: "USD",
      unit_amount: unitPrice,
      product_data: {
        name: productName,
      },
    });
    return productAndPrice;
  } catch (err) {
    logger.info(
      "An error occured whilst trying to create a product with an associated price!",
      err
    );
    return null;
  }
};

const createPaymentSession = async (
  params: TStripeCreatePaymentSessionParams
): Promise<Stripe.Checkout.Session | null> => {
  try {
    const { accountId, priceId, applicationFee } = params;
    const paymentSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: accountId,
        },
      },
      success_url: `${uri}${paymentSuccessUri}`,
      cancel_url: `${uri}${paymentCancelUri}`,
    });
    return paymentSession;
  } catch (err) {
    logger.info("An error occured whilst trying to a payment session!", err);
    return null;
  }
};

const stripeApi: IStripeApi = {
  createAccount,
  createAccountLink,
  createProductWithPrice,
  createPaymentSession,
};

export default stripeApi;
