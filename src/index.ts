import express from "express";

import config from "./config";

const { port } = config.app;
const app = express();
app.listen(port, async () => {
  console.log(`Listening on port ${port}!`);
});
