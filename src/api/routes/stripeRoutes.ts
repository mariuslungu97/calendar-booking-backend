import express from "express";
import config from "../../config";

import {
  accountUpdateEventHandler,
  checkoutSessionFailureEventHandler,
  checkoutSessionSuccessEventHandler,
} from "../controllers/stripeController";

const stripeRouter = express.Router();

const {
  accountUpdateEventUri,
  sessionSuccessEventUri,
  sessionFailureEventUri,
} = config.stripe;

stripeRouter.post(accountUpdateEventUri, accountUpdateEventHandler);
stripeRouter.post(sessionFailureEventUri, checkoutSessionFailureEventHandler);
stripeRouter.post(sessionSuccessEventUri, checkoutSessionSuccessEventHandler);

export default stripeRouter;
