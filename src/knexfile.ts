const config = {
  client: "pg",
  connection: {
    host: process.env.APP_DB_HOST,
    port: process.env.APP_DB_PORT || 5432,
    user: process.env.APP_DB_USER,
    password: process.env.APP_DB_PASSWORD,
    database: process.env.APP_DB_DATABASE,
  },
  migrations: {
    tableName: "knex_migrations",
    schemaName: "public",
    extension: "ts",
    directory: "database/migrations",
  },
};

export default config;
