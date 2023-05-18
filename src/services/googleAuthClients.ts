import { OAuth2Client, Credentials } from "google-auth-library";

import logger from "../loaders/logger";
import knexClient from "../loaders/knex";
import oAuthApi from "./googleOAuth";

import { IGoogleAuthClientsStore } from "../types";

type TAuthClientDict = { [id: string]: OAuth2Client };

const appAuthClients: TAuthClientDict = {};

const handleAccessTokenRefresh = async (
  userId: string,
  tokens: Credentials
) => {
  if (userId in appAuthClients && tokens.access_token) {
    const authClient = appAuthClients[userId];
    try {
      const updatedConnection = await knexClient("oauth_connections")
        .where({ user_id: userId, provider: "GOOGLE" })
        .update(
          {
            access_token: tokens.access_token,
          },
          ["access_token", "refresh_token"]
        );

      authClient.setCredentials({
        access_token: (updatedConnection as any).access_token,
        refresh_token: (updatedConnection as any).refresh_token,
      });
    } catch (err) {
      logger.info("Failed to update user's access token!");
      logger.info(err);
    }
  }
};

const addClient = (userId: string, authClient: OAuth2Client) => {
  if (userId in appAuthClients) return;
  authClient.on("tokens", (newTokens) =>
    handleAccessTokenRefresh(userId, newTokens)
  );
  appAuthClients[userId] = authClient;
};

const removeClient = (userId: string) => {
  if (!(userId in appAuthClients)) return;

  delete appAuthClients[userId];
};

const getClient = (userId: string) => {
  if (!(userId in appAuthClients)) return null;

  return appAuthClients[userId];
};

const hydrateStore = async () => {
  try {
    const connections = await knexClient()
      .select()
      .from("oauth_connections")
      .where({ provider: "GOOGLE" });
    for (const connection of connections) {
      const authClient = oAuthApi.getOAuthClient();
      authClient.setCredentials({
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
      });
      authClient.on("tokens", (newTokens) =>
        handleAccessTokenRefresh(connection.user_id, newTokens)
      );
      appAuthClients[connection.user_id] = authClient;
    }
  } catch (err) {
    logger.info("Failed to hydrate auth clients store!");
    logger.info(err);
  }
};

const googleAuthStore: IGoogleAuthClientsStore = {
  addClient,
  removeClient,
  getClient,
  hydrateStore,
};

export default googleAuthStore;
