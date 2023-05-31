import knex from "knex";

import config from "../config";

const { host, port, user, password, database } = config.db;

export default knex({
  client: "pg",
  connection: {
    host,
    port,
    user,
    password,
    database,
  },
  useNullAsDefault: true,
});
