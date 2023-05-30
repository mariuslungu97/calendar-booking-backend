import express from "express";
import config from "../../config";

import {
  oAuthCallbackHandler,
  calendarEventHandler,
} from "../controllers/googleController";

const googleRouter = express.Router();

const { redirectUri, calendarWebhookUri } = config.google;

googleRouter.get(redirectUri, oAuthCallbackHandler);
googleRouter.post(calendarWebhookUri, calendarEventHandler);

export default googleRouter;
