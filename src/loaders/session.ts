import session from "express-session";
import RedisStore from "connect-redis";

import config from "../config";
import redisConnection from "./redis";

const { isDev, sessionSecret } = config.app;

const sessionStore = new RedisStore({
  client: redisConnection(),
});

const appSession = session({
  resave: false,
  store: sessionStore,
  secret: sessionSecret,
  saveUninitialized: true,
  cookie: { httpOnly: true, secure: !isDev, maxAge: 1000 * 60 * 60 * 2 },
});

export default appSession;
