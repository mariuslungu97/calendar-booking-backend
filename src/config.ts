const mandatoryEnv = (
  env: string | null | undefined,
  fieldName: string
): string => {
  if (env === null || env === undefined)
    throw new Error(
      `${fieldName} is mandatory! Please include it in your .env file.`
    );
  return env;
};

const config = {
  app: {
    isDev: mandatoryEnv(process.env.NODE_ENV, "NODE_ENV") === "development",
  },
  db: {
    host: mandatoryEnv(process.env.APP_DB_HOST, "APP_DB_HOST"),
    user: mandatoryEnv(process.env.APP_DB_USER, "APP_DB_USER"),
    password: mandatoryEnv(process.env.APP_DB_PASSWORD, "APP_DB_PASSWORD"),
    port: (process.env.APP_DB_PORT && +process.env.APP_DB_PORT) || 5432,
    database: process.env.APP_DB_DATABASE,
  },
};

export default config;
