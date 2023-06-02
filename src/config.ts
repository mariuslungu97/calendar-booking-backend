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

const webClientUri = mandatoryEnv(process.env.WEB_CLIENT_URI, "WEB_CLIENT_URI");

const config = {
  web: { clientUri: webClientUri },
  app: {
    isDev: mandatoryEnv(process.env.NODE_ENV, "NODE_ENV") === "development",
    port: +mandatoryEnv(process.env.APP_PORT, "APP_PORT"),
    proto: mandatoryEnv(process.env.APP_PROTO, "APP_PROTO"),
    host: process.env.APP_HOST || "localhost",
    name: process.env.APP_NAME || "My Booking App",
    uri: `${process.env.APP_PROTO}://${process.env.APP_HOST}:${process.env.APP_PORT}`,
    sessionSecret: mandatoryEnv(
      process.env.APP_SESSION_SECRET,
      "APP_SESSION_SECRET"
    ),
    jwtSecret: mandatoryEnv(process.env.APP_JWT_SECRET, "APP_JWT_SECRET"),
    authTwoFactorUri: process.env.APP_TWO_FACTOR_URI || "/api/auth/2fa",
    authEmailVerifyUri: process.env.APP_EMAIL_VERIFY_URI || "/api/auth/verify",
    cancelEventsUri: process.env.APP_CANCEL_EVENTS_URI || "/api/events/cancel",
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
      process.env.APP_GOOGLE_REDIRECT_URI || "/api/google/oauth/callback",
    calendarWebhookUri:
      process.env.APP_GOOGLE_CALENDAR_WEBHOOK_URI ||
      "/api/google/calendar/events",
  },
  smtp: {
    host: process.env.APP_SMTP_HOST,
    port: process.env.APP_SMTP_PORT && +process.env.APP_SMTP_PORT,
    user: process.env.APP_SMTP_USER,
    pass: process.env.APP_SMTP_PASS,
  },
  stripe: {
    apiKey: mandatoryEnv(process.env.STRIPE_API_KEY, "STRIPE_API_KEY"),
    webhookEndpointsSecret: mandatoryEnv(
      process.env.STRIPE_WEBHOOK_ENDPOINTS_SECRET,
      "STRIPE_WEBHOOK_ENDPOINTS_SECRET"
    ),
    accountLinkRefreshUri: webClientUri + "/stripe/connect/refresh",
    accountLinkReturnUri: webClientUri + "/stripe/connect/return",
    paymentSuccessUri: webClientUri,
    paymentCancelUri: webClientUri,
    accountUpdateEventUri:
      process.env.STRIPE_ACCOUNT_UPDATE_EVENT_URI ||
      "/api/stripe/events/account",
    sessionSuccessEventUri:
      process.env.STRIPE_SESSION_SUCCESS_EVENT_URI ||
      "/api/stripe/events/session/success",
    sessionFailureEventUri:
      process.env.STRIPE_SESSION_FAILURE_EVENT_URI ||
      "/api/stripe/events/session/failure",
  },
  graphql: {
    path: process.env.APP_GRAPHQL_PATH || "/graphql",
  },
};

export default config;
