import { OAuth2Client, Credentials } from "google-auth-library";

import logger from "../loaders/logger";
import knexClient from "../loaders/knex";
import oAuthApi from "./googleOAuth";
import authClientsPubSubApi from "./authClientsPubSub";

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

const addClient = (
  userId: string,
  authClient: OAuth2Client,
  publish = true
) => {
  if (userId in appAuthClients) return;
  authClient.on("tokens", (newTokens) =>
    handleAccessTokenRefresh(userId, newTokens)
  );
  appAuthClients[userId] = authClient;

  if (publish) authClientsPubSubApi.publish({ action: "ADD", userId });
};

const removeClient = (userId: string, publish = true) => {
  if (!(userId in appAuthClients)) return;

  delete appAuthClients[userId];

  if (publish) authClientsPubSubApi.publish({ action: "DELETE", userId });
};

const getClient = (userId: string) => {
  if (!(userId in appAuthClients)) return null;

  return appAuthClients[userId];
};

const isClientInStore = (userId: string) => userId in appAuthClients;

const hydrateStore = async () => {
  logger.info("Hydrating store using users' google connections!");
  try {
    const connections = await knexClient()
      .select("*")
      .from("oauth_connections")
      .where({ provider: "GOOGLE" });

    for (const connection of connections) {
      const authClient = oAuthApi.getOAuthClient();
      authClient.setCredentials({
        access_token: connection.access_token,
        refresh_token: connection.refresh_token,
      });
      addClient(connection.user_id, authClient, false);
    }
  } catch (err) {
    logger.info("Failed to hydrate auth clients store!");
    logger.info(err);
    throw err;
  }
};

const googleAuthStore: IGoogleAuthClientsStore = {
  addClient,
  removeClient,
  getClient,
  isClientInStore,
  hydrateStore,
};

export default googleAuthStore;
