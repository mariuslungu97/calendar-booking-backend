import express from "express";
import config from "../../config";
import bodyParser from "body-parser";

import {
  accountUpdateEventHandler,
  checkoutSessionExpiredEventHandler,
  checkoutSessionCompletedEventHandler,
} from "../controllers/stripeController";

const stripeRouter = express.Router();

const {
  accountUpdateEventUri,
  sessionExpiredEventUri,
  sessionCompletedEventUri,
} = config.stripe;

stripeRouter.post(
  accountUpdateEventUri,
  bodyParser.raw({ type: "application/json" }),
  accountUpdateEventHandler
);
stripeRouter.post(
  sessionExpiredEventUri,
  bodyParser.raw({ type: "application/json" }),
  checkoutSessionExpiredEventHandler
);
stripeRouter.post(
  sessionCompletedEventUri,
  bodyParser.raw({ type: "application/json" }),
  checkoutSessionCompletedEventHandler
);

export default stripeRouter;
