import express from "express";
import config from "../../config";
import bodyParser from "body-parser";

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

stripeRouter.post(
  accountUpdateEventUri,
  bodyParser.raw({ type: "application/json" }),
  accountUpdateEventHandler
);
stripeRouter.post(
  sessionFailureEventUri,
  bodyParser.raw({ type: "application/json" }),
  checkoutSessionFailureEventHandler
);
stripeRouter.post(
  sessionSuccessEventUri,
  bodyParser.raw({ type: "application/json" }),
  checkoutSessionSuccessEventHandler
);

export default stripeRouter;
