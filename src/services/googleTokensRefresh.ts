import { OAuth2Client, Credentials } from "google-auth-library";

import logger from "../loaders/logger";
import knexClient from "../loaders/knex";

type TAuthClientsDict = { [id: string]: OAuth2Client };

let refreshClientsDict: TAuthClientsDict = {};

const refreshTokens = (userId: string, authClient: OAuth2Client) => {
  const handleRefresh = async (newTokens: Credentials) => {
    let tokens: Credentials = {
      access_token: authClient.credentials.access_token,
      refresh_token: authClient.credentials.refresh_token,
    };

    if (newTokens.refresh_token) tokens.refresh_token = newTokens.refresh_token;
    if (newTokens.access_token) tokens.access_token = newTokens.access_token;

    try {
      await knexClient("connections").where({ user_id: userId }).update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      authClient.setCredentials(tokens);
    } catch (err) {
      logger.info("Failed updating user's GOOGLE 'connection' row: ", err);
    }
  };

  authClient.on("tokens", handleRefresh);
  refreshClientsDict[userId] = authClient;
};

const stopRefreshTokens = (userId: string) => {
  if (!(userId in refreshClientsDict)) return;
  refreshClientsDict[userId].removeAllListeners("tokens");
  delete refreshClientsDict[userId];
};

const stopRefreshAll = () => {
  for (const authClient of Object.values(refreshClientsDict)) {
    authClient.removeAllListeners("tokens");
  }
  refreshClientsDict = {};
};

export { refreshTokens, stopRefreshTokens, stopRefreshAll };
