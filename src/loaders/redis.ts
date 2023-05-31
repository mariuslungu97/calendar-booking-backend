import Redis from "ioredis";

import config from "../config";

const { host, port, user, password } = config.redis;

const redisConnection = () =>
  new Redis({
    host,
    port,
    password,
    username: user,
  });

export default redisConnection;
