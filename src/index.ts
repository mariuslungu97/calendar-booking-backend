import express, { Request, Response } from "express";
import knex from "knex";

import config from "./config";

const { host, port, user, password, database } = config.db;
const knexDbInstance = knex({
  client: "pg",
  connection: {
    host,
    port,
    user,
    password,
    database,
  },
});
const app = express();

app.get("/api", (_: Request, res: Response) => {
  res.setHeader("Content-type", "text/html");
  res.send(`<p>Hello My Lexi lex! ${process.env.NODE_ENV}</p>`);
});

const appPort = (process.env.APP_PORT && +process.env.APP_PORT) || 3000;

app.listen(appPort, async () => {
  console.log(`Listening on port ${appPort}!`);
});
