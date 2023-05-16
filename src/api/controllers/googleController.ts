import { Request, Response } from "express";

import knexClient from "../../loaders/knex";
import logger from "../../loaders/logger";

import syncApi from "../../services/calendarSync";
import oAuthApi from "../../services/googleOAuth";
import googleAuthStore from "../../services/googleAuthClients";

import {
  IRestApiResponse,
  TUserSessionData,
  ConnectionCreateInput,
} from "../../types";

type TOAuthHandlerParams = {
  error?: string;
  code?: string;
};

const oAuthHandler = (_: Request, res: Response) => {
  return res.status(303).redirect(oAuthApi.generateOAuthUrl());
};

const oAuthCallbackHandler = async (
  req: Request<TOAuthHandlerParams>,
  res: Response<IRestApiResponse<any, any>>
) => {
  const { error: errorInfo, code } = req.params;

  if (errorInfo)
    return res.status(401).json({
      code: 401,
      message: "You have failed to connect to Google, please try again!",
      error: { info: errorInfo },
    });

  const userSession = req.session.user as TUserSessionData;
  const authCode = code as string;
  try {
    const authClient = await oAuthApi.getOAuthClientWithTokens(authCode);
    if (!authClient)
      return res.status(500).json({
        code: 500,
        message: "An unexpected error has occured, please try again later!",
      });

    // create connection
    await knexClient<ConnectionCreateInput>("connections").insert({
      user_id: userSession.id,
      provider: "GOOGLE",
      access_token: authClient.credentials.access_token as string,
      refresh_token: authClient.credentials.refresh_token as string,
      sync_token: undefined,
    });

    res.status(200).json({
      code: 200,
      message:
        "You have succesfully connected your Google Calendar account to the calendar booking system!",
    });

    // start google tokens refresh service
    googleAuthStore.addClient(userSession.id, authClient);

    // start calendar sync routine
    syncApi.startSyncRoutine(userSession.id);
  } catch (err) {
    logger.info("An API error has occured!", err);
    return res.status(500).json({
      code: 500,
      message: "An unexpected error has occured, please try again later!",
    });
  }
};

const calendarEventHandler = async (req: Request, res: Response) => {
  const userId = req.header("X-Goog-Channel-ID");

  if (!userId) return res.status(400).json({});

  res.status(200).json({});

  syncApi.addOneTimeSyncJob("incrementalSync", userId, { userId });
};

export { oAuthHandler, oAuthCallbackHandler, calendarEventHandler };
