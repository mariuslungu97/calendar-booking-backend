import express from "express";

import config from "./config";
import googleRouter from "./api/routes/googleRoutes";
import googleAuthStore from "./services/googleAuthClients";

import fullSyncCalendarWorker from "./workers/fullSync";
import incrementalSyncCalendarWorker from "./workers/incrementalSync";
import refreshNotificationChannelsWorker from "./workers/refreshNotificationsChannel";

const startWorkers = async () => {
  await fullSyncCalendarWorker.run();
  await incrementalSyncCalendarWorker.run();
  await refreshNotificationChannelsWorker.run();
};

const { port } = config.app;
const app = express();

app.use("/api", googleRouter);

app.listen(port, async () => {
  console.log(`Listening on port ${port}!`);

  await googleAuthStore.hydrateStore();
  await startWorkers();
});
