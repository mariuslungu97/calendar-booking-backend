import { google } from "googleapis";
import { Credentials } from "google-auth-library";

import logger from "../loaders/logger";
import config from "../config";

import { IGoogleOAuthApi } from "../types";

const { uri } = config.app;
const { clientId, clientSecret, redirectUri } = config.google;

const appOAuthClient = new google.auth.OAuth2(
  clientId,
  clientSecret,
  `${uri}${redirectUri}`
);

const scopes = ["https://www.googleapis.com/auth/calendar.events"];

const generateOAuthUrl = () =>
  appOAuthClient.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
  });

const getTokens = async (
  authorizationCode: string
): Promise<Credentials | null> => {
  try {
    const { tokens } = await appOAuthClient.getToken(authorizationCode);
    return tokens;
  } catch (err) {
    logger.info("Failed retrieving Google OAuth tokens: ", err);
    return null;
  }
};

const getOAuthClient = () =>
  new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const getOAuthClientWithTokens = async (authorizationCode: string) => {
  try {
    const tokens = await getTokens(authorizationCode);
    if (!tokens) return null;

    const authClient = getOAuthClient();
    authClient.setCredentials(tokens);

    return authClient;
  } catch (err) {
    logger.info(err);
    return null;
  }
};

const revokeOAuthTokens = async (accessToken: string) => {
  try {
    await getOAuthClient().revokeToken(accessToken);
    return;
  } catch (err) {
    logger.info("Failed revoking Google OAuth tokens: ", err);
  }
};

const oAuthApi: IGoogleOAuthApi = {
  generateOAuthUrl,
  getOAuthClient,
  getTokens,
  getOAuthClientWithTokens,
  revokeOAuthTokens,
};

export default oAuthApi;
