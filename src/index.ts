import express from "express";

import config from "./config";
import knex from "./loaders/knex";
import yoga from "./loaders/graphql";
import logger from "./loaders/logger";
import appSession from "./loaders/session";
import syncApi from "./services/calendarSync";
import authRouter from "./api/routes/authRoutes";
import googleRouter from "./api/routes/googleRoutes";
import stripeRouter from "./api/routes/stripeRoutes";
import bullBoardServerAdapter from "./loaders/bullBoard";
import googleAuthStore from "./services/googleAuthClients";

import mailTransportWorker from "./workers/mailTransport";
import fullSyncCalendarWorker from "./workers/fullSync";
import incrementalSyncCalendarWorker from "./workers/incrementalSync";
import refreshNotificationChannelsWorker from "./workers/refreshNotificationsChannel";

const startWorkers = async () => {
  await mailTransportWorker.run();
  await fullSyncCalendarWorker.run();
  await incrementalSyncCalendarWorker.run();
  await refreshNotificationChannelsWorker.run();
};

const batchStartCalendarSync = async () => {
  logger.info(
    "Starting calendar sync processes for users that are connected to Google!"
  );

  try {
    const googleConnections = await knex("oauth_connections")
      .select("user_id")
      .where("provider", "GOOGLE");
    const userIds = googleConnections.map((conn) => conn.user_id);
    const googleConnectedUsers = await knex("users")
      .select("id")
      .whereIn("id", userIds);

    for (const user of googleConnectedUsers) {
      const isUserInSync = await syncApi.isUserInSync(user.id);
      if (!isUserInSync) {
        await syncApi.startSyncRoutine(user.id);
      }
    }
  } catch (err) {
    logger.error(
      "Unexpected error trying to batch start calendar sync processes for users!"
    );
    logger.error(err);
    throw err;
  }
};

const app = express();

const { port, isDev } = config.app;
if (isDev) app.use("/admin/queues", bullBoardServerAdapter.getRouter());
app.use(appSession);
app.use("/api", authRouter);
app.use("/api", googleRouter);
app.use("/api", stripeRouter);
app.use(yoga.graphqlEndpoint, yoga);

app.listen(port, async () => {
  console.log(`Listening on port ${port}!`);

  await googleAuthStore.hydrateStore();
  await startWorkers();
  await batchStartCalendarSync();
});
