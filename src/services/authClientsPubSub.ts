import knexClient from "../loaders/knex";

import oAuthApi from "./googleOAuth";
import googleAuthStore from "./googleAuthClients";
import logger from "../loaders/logger";
import redisConnection from "../loaders/redis";

import {
  IGoogleAuthClientsPubSubApi,
  TAuthClientsPubSubMessage,
} from "../types";

const authClientsChannelName = "authClientsChannel";

const authClientsPublisher = redisConnection();
const authClientsSubscriber = redisConnection();

authClientsSubscriber.subscribe(authClientsChannelName, (err) => {
  if (err) {
    logger.error("Failed to subscribe: %s", err.message);
  } else {
    logger.info(`PubSub - Subscribed successfully!`);
  }
});

authClientsSubscriber.on("message", async (channel, message) => {
  if (channel === authClientsChannelName) {
    const { action, userId } = JSON.parse(message) as TAuthClientsPubSubMessage;

    // add or remove auth client from auth store
    if (action === "ADD" && !googleAuthStore.isClientInStore(userId)) {
      const usersList = await knexClient("oauth_connections")
        .select("access_token", "refresh_token")
        .where({ user_id: userId });
      if (usersList.length === 0) return;

      const user = usersList[0];
      const authClient = oAuthApi.getOAuthClient();
      authClient.setCredentials({
        access_token: user.access_token,
        refresh_token: user.refresh_token,
      });

      googleAuthStore.addClient(userId, authClient, false);
    } else if (action === "DELETE") {
      googleAuthStore.removeClient(userId, false);
    }
  }
});

const publish = async (message: TAuthClientsPubSubMessage) => {
  try {
    await authClientsPublisher.publish(
      authClientsChannelName,
      JSON.stringify(message)
    );
    return;
  } catch (err) {
    logger.info(
      `Encountered an error whilst attempting to publish a message to the ${authClientsChannelName} channel!`,
      err
    );
  }
};

const authClientsPubSubApi: IGoogleAuthClientsPubSubApi = {
  publish,
};

export default authClientsPubSubApi;
