import knex from "knex";

import config from "../config";

const { host, port, user, password, database } = config.db;

export default knex({
  connection: {
    host,
    port,
    user,
    password,
    database,
  },
});
