import { Request, Response } from "express";

import knexClient from "../../loaders/knex";
import logger from "../../loaders/logger";

import syncApi from "../../services/calendarSync";
import oAuthApi from "../../services/googleOAuth";
import googleAuthStore from "../../services/googleAuthClients";

import { IRestApiResponse } from "../../types";

type TOAuthHandlerParams = {
  error?: string;
  code?: string;
  state?: string;
};

const oAuthCallbackHandler = async (
  req: Request<any, any, any, TOAuthHandlerParams>,
  res: Response<IRestApiResponse<any, any>>
) => {
  const { error: errorInfo, code, state } = req.query;

  if (errorInfo || !state) {
    if (!state)
      logger.error(
        "No state to identify user available in Google's oauth callback handler!"
      );
    const statusCode = errorInfo ? 401 : 500;
    const jsonMessage = errorInfo
      ? "You have failed to connect to Google, please try again!"
      : "An unexpected error has occured, please try again later!";
    return res.status(statusCode).json({
      code: statusCode,
      message: jsonMessage,
      ...(errorInfo && { info: errorInfo }),
    });
  }

  const authState = JSON.parse(
    Buffer.from(state, "base64url").toString("ascii")
  );
  const userId = authState.userId;
  const authCode = code as string;
  try {
    const authClient = await oAuthApi.getOAuthClientWithTokens(authCode);
    if (!authClient)
      return res.status(500).json({
        code: 500,
        message: "An unexpected error has occured, please try again later!",
      });

    const { access_token, refresh_token } = authClient.credentials;

    // create connection
    await knexClient("oauth_connections").insert({
      refresh_token,
      user_id: userId,
      provider: "GOOGLE",
      access_token: access_token as string,
    });

    res.status(200).json({
      code: 200,
      message:
        "You have succesfully connected your Google Calendar account to the calendar booking system!",
    });

    // start google tokens refresh service
    googleAuthStore.addClient(userId, authClient);

    // start calendar sync routine
    syncApi.startSyncRoutine(userId);
  } catch (err) {
    logger.info("An API error has occured!", err);
    return res.status(500).json({
      code: 500,
      message: "An unexpected error has occured, please try again later!",
    });
  }
};

const calendarEventHandler = async (req: Request, res: Response) => {
  // TODO implement token security to avoid replay attacks
  const userId = req.header("X-Goog-Channel-ID");

  if (!userId) return res.status(400).json({});

  res.status(200).json({});

  syncApi.addOneTimeSyncJob("incrementalSync", userId, { userId });
};

export { oAuthCallbackHandler, calendarEventHandler };
