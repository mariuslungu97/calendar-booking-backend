import Redis from "ioredis";

import config from "../config";

const { host, port, user, password } = config.redis;

const redisClient = new Redis({
  host,
  port,
  username: user,
  password,
});

export default redisClient;
