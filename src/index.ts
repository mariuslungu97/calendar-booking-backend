import express from "express";

import config from "./config";
import yoga from "./loaders/graphql";
import appSession from "./loaders/session";
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
});
