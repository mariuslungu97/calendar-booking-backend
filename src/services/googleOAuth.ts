import { google } from "googleapis";
import { Credentials } from "google-auth-library";

import logger from "../loaders/logger";
import config from "../config";

const { clientId, clientSecret, redirectUri } = config.google;

const appOAuthClient = new google.auth.OAuth2(
  clientId,
  clientSecret,
  redirectUri
);

const scopes = ["https://www.googleapis.com/auth/calendar.events"];

const generateAuthUrl = () =>
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
    logger.info(err);
    return null;
  }
};

const getOAuthClient = () =>
  new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const getClientWithTokens = async (authorizationCode: string) => {
  const tokens = await getTokens(authorizationCode);
  if (!tokens) return;

  const authClient = getOAuthClient();
  authClient.setCredentials(tokens);

  return authClient;
};

export { getOAuthClient, getClientWithTokens, generateAuthUrl };
