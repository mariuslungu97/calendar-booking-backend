import express from "express";
import config from "../../config";

import { isLoggedIn } from "../middleware/auth";
import {
  oAuthHandler,
  oAuthCallbackHandler,
  calendarEventHandler,
} from "../controllers/googleController";

const googleRouter = express.Router();

const { redirectUri, calendarWebhookUri } = config.google;

googleRouter.get("/google/oauth", isLoggedIn, oAuthHandler);
googleRouter.get(redirectUri, oAuthCallbackHandler);
googleRouter.post(calendarWebhookUri, calendarEventHandler);

export default googleRouter;
