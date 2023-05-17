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
    port: +mandatoryEnv(process.env.APP_PORT, "APP_PORT"),
    proto: mandatoryEnv(process.env.APP_PROTO, "APP_PROTO"),
    host: process.env.APP_HOST || "localhost",
    uri: `${process.env.APP_PROTO}://${process.env.APP_HOST}:${process.env.APP_PORT}`,
  },
  db: {
    host: mandatoryEnv(process.env.APP_DB_HOST, "APP_DB_HOST"),
    user: mandatoryEnv(process.env.APP_DB_USER, "APP_DB_USER"),
    password: mandatoryEnv(process.env.APP_DB_PASSWORD, "APP_DB_PASSWORD"),
    port: (process.env.APP_DB_PORT && +process.env.APP_DB_PORT) || 5432,
    database: process.env.APP_DB_DATABASE,
  },
  redis: {
    host: mandatoryEnv(process.env.APP_REDIS_HOST, "APP_REDIS_HOST"),
    port: +mandatoryEnv(process.env.APP_REDIS_PORT, "APP_REDIS_PORT") || 6379,
    user: process.env.APP_REDIS_USER,
    password: process.env.APP_REDIS_PASSWORD,
  },
  google: {
    clientId: process.env.APP_GOOGLE_CLIENT_ID,
    clientSecret: process.env.APP_GOOGLE_CLIENT_SECRET,
    redirectUri:
      process.env.APP_GOOGLE_REDIRECT_URI || "/google/oauth/callback",
    calendarWebhookUri:
      process.env.APP_GOOGLE_CALENDAR_WEBHOOK_URI || "/google/calendar/events",
  },
  stripe: {
    apiKey: mandatoryEnv(process.env.STRIPE_API_KEY, "STRIPE_API_KEY"),
    accountLinkRefreshUri:
      process.env.STRIPE_ACCOUNT_LINKS_REFRESH_URI ||
      "/stripe/accounts/refresh",
    accountLinkReturnUri:
      process.env.STRIPE_ACCOUNT_LINKS_RETURN_URI || "/stripe/accounts/return",
    paymentSuccessUri:
      process.env.STRIPE_PAYMENT_SUCCESS_URI || "/stripe/payments/success",
    paymentCancelUri:
      process.env.STRIPE_PAYMENT_CANCEL_URI || "/stripe/payments/cancel",
  },
  graphql: {
    path: process.env.APP_GRAPHQL_PATH || "graphql",
  },
};

export default config;
