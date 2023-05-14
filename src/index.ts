import express from "express";

import fullSyncCalendarWorker from "./workers/fullSync";
import incrementalSyncCalendarWorker from "./workers/incrementalSync";
import config from "./config";

const { proto, port } = config.app;
const app = express();

app.listen(port, async () => {
  console.log(`Listening on port ${port}!`);

  if (proto === "http") {
    await fullSyncCalendarWorker.start();
    await incrementalSyncCalendarWorker.start();
  }
});
