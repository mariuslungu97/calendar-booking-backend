import { GraphQLError } from "graphql";
import { ValidationError } from "joi";
import bcrypt from "bcrypt";
import Stripe from "stripe";

import logger from "../../../../loaders/logger";

import { userCreateValidationSchema } from "./userValidation";
import { isLoggedIn } from "../../../middleware/auth";

import { User, GraphQlContext, TUserSessionData } from "../../../../types";

interface UserCreateInputParams {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface UserLoginParams {
  email: string;
  password: string;
}

const userFields = {
  User: {
    fullName: (parent: User) => `${parent.first_name} ${parent.last_name}`,
    isVerified: (parent: User) => parent.is_email_verified,
    is2FaActivated: (parent: User) => parent.is_2fa_activated,
    createdAt: (parent: User) => parent.created_at,
    upcomingEvents: async (parent: User, _: any, ctx: GraphQlContext) => {
      try {
        const { id } = parent;
        const { dbClient } = ctx.services;

        const upcomingEvents = await dbClient("events")
          .select("events.*")
          .leftJoin(
            "event_schedules",
            "events.event_schedule_id",
            "=",
            "event_schedules.id"
          )
          .where("user_id", id)
          .andWhere("start_date_time", ">", Math.floor(Date.now() / 1000))
          .orderBy("start_date_time", "asc")
          .limit(3);

        return upcomingEvents;
      } catch (err) {
        logger.error("Upcoming Events Resolver Error: ", err);
        throw new GraphQLError(
          "Unexpected error trying to retrieve upcoming events for user!"
        );
      }
    },
    recentEventTypes: async (parent: User, _: any, ctx: GraphQlContext) => {
      try {
        const { id } = parent;
        const { dbClient } = ctx.services;

        const recentEventTypes = await dbClient("event_types")
          .select("*")
          .where({ user_id: id })
          .orderBy("updated_at", "desc")
          .limit(3);

        return recentEventTypes;
      } catch (err) {
        logger.error("Recent Event Types Resolver Error: ", err);
        throw new GraphQLError(
          "Unexpected error trying to retrieve recent event types for user!"
        );
      }
    },
    recentPayments: async (parent: User, _: any, ctx: GraphQlContext) => {
      try {
        const { id } = parent;
        const { dbClient } = ctx.services;

        const recentPayments = await dbClient("payments")
          .select("*")
          .where({ user_id: id })
          .orderBy("created_at", "desc")
          .limit(3);

        return recentPayments;
      } catch (err) {
        logger.error("Recent Payments Resolver Error: ", err);
        throw new GraphQLError(
          "Unexpected error trying to retrieve recent payments for user!"
        );
      }
    },
  },
};

const userQueries = {
  me: async (_: any, __: any, ctx: GraphQlContext) => {
    const { req } = ctx;
    const { dbClient } = ctx.services;
    if (!isLoggedIn(req)) throw new GraphQLError("You are not authenticated!");

    const { id } = req.session.user as TUserSessionData;

    try {
      const userList = await dbClient("users").select("*").where({ id });
      if (!userList.length)
        throw new GraphQLError("Unexpected error trying to retrieve user!");

      return userList[0];
    } catch (err) {
      logger.error("Me Resolver Error: ", err);
      throw new GraphQLError("Unexpected error trying to retrieve user!");
    }
  },
};

const userMutations = {
  createAccount: async (
    _: any,
    params: UserCreateInputParams,
    ctx: GraphQlContext
  ) => {
    try {
      await userCreateValidationSchema.validateAsync(params);

      const { dbClient } = ctx.services;
      const { username, email, password, firstName, lastName } = params;

      const existingAccountList = await dbClient("users")
        .select("id")
        .where("username", username)
        .orWhere("email", email);
      if (existingAccountList.length)
        throw new GraphQLError(
          "An user with the same email and/or username already exists!"
        );

      const saltRounds = 10;
      const cryptedPass = await bcrypt.hash(password, saltRounds);

      await dbClient("users").insert({
        email,
        username,
        first_name: firstName,
        last_name: lastName,
        password: cryptedPass,
      });

      return {
        message:
          "You have succesfully created an account. You can now login using your email and password!",
      };
    } catch (err) {
      if (err instanceof ValidationError) {
        const { details } = err;
        const messages = details.reduce(
          (prev, detail) => (prev += detail.message + " "),
          ""
        );
        throw new GraphQLError(messages);
      }
      logger.error("Create Account Resolver Error", err);
      throw new GraphQLError("Unexpected error trying to create account");
    }
  },
  login: async (_: any, params: UserLoginParams, ctx: GraphQlContext) => {
    try {
      const { req } = ctx;
      const { dbClient, emailApi } = ctx.services;
      const { email, password } = params;

      const loggedAccountList = await dbClient("users").where("email", email);
      if (!loggedAccountList.length)
        throw new GraphQLError(
          "The provided email and/or password are incorrect!"
        );

      const loggedAccount = loggedAccountList[0];
      const doPasswordsMatch = await bcrypt.compare(
        password,
        loggedAccount.password
      );
      if (!doPasswordsMatch)
        throw new GraphQLError(
          "The provided email and/or password are incorrect!"
        );

      let message = "";
      if (!loggedAccount.is_2fa_activated) {
        message = "You have succesfully logged in!";
        req.session.user = {} as TUserSessionData;
        req.session.user.id = loggedAccount.id;
        req.session.user.email = loggedAccount.email;
      } else {
        message =
          "You have 2 factor authentication enabled. Click the link we've sent to your email address to login!";
        const { username, first_name: userFirstName } = loggedAccount;
        emailApi.sendMail({
          to: loggedAccount.email,
          type: "TWO_FACTOR_AUTH",
          payload: { username, userFirstName },
        });
      }

      return {
        message,
        is2FaActivated: loggedAccount.is_2fa_activated,
      };
    } catch (err) {
      if (err instanceof ValidationError) {
        const { details } = err;
        const messages = details.reduce(
          (prev, detail) => (prev += detail.message + " "),
          ""
        );
        throw new GraphQLError(messages);
      }
      logger.error("Login Account Resolver Error", err);
      throw new GraphQLError("Unexpected error trying to login into account");
    }
  },
  activate2Fa: async (_: any, __: any, ctx: GraphQlContext) => {
    const { req } = ctx;
    const { dbClient } = ctx.services;

    if (!isLoggedIn(req)) throw new GraphQLError("You are not authenticated!");

    const { id } = ctx.req.session.user as TUserSessionData;

    try {
      await dbClient("users")
        .update({ is_2fa_activated: true })
        .where("id", id);

      const updatedUserList = await dbClient("users")
        .select("*")
        .where("id", id);

      return updatedUserList[0];
    } catch (err) {
      logger.error("Activate2Fa Account Resolver Error", err);
      throw new GraphQLError(
        "Unexpected error trying to activate 2 factor authentication"
      );
    }
  },
  connectGoogleCalendar: async (_: any, __: any, ctx: GraphQlContext) => {
    const { req } = ctx;
    const { oAuthApi } = ctx.services;

    if (!isLoggedIn(req)) throw new GraphQLError("You are not authenticated!");

    const userSession = req.session.user as TUserSessionData;
    const authState = { userId: userSession.id };
    const encodedState = Buffer.from(JSON.stringify(authState)).toString(
      "base64url"
    );

    let authUrl = oAuthApi.generateOAuthUrl();
    authUrl += `state=${encodedState}`;

    return {
      message: "Follow the redirect link to connect to your Google Calendar!",
      redirect: authUrl,
    };
  },
  connectStripe: async (_: any, __: any, ctx: GraphQlContext) => {
    const { req } = ctx;
    const { dbClient, stripeApi } = ctx.services;

    if (!isLoggedIn(req)) throw new GraphQLError("You are not authenticated!");

    const { id } = ctx.req.session.user as TUserSessionData;

    try {
      const userList = await dbClient("users").select("*").where("id", id);

      if (!userList.length)
        throw new GraphQLError(
          "Unexpected error trying to connect a Stripe account"
        );

      const user = userList[0];
      if (!user.is_email_verified)
        throw new GraphQLError(
          "You cannot connect a Stripe account without having verified your email!"
        );
      if (!user.is_2fa_activated)
        throw new GraphQLError(
          "You cannot connect a Stripe account without having 2 factor authentication activated!"
        );

      let stripeAccount: Stripe.Account | null = null;
      const stripeAccountId = user.stripe_account_id;

      if (stripeAccountId) {
        stripeAccount = await stripeApi.retrieveAccount({
          accountId: stripeAccountId,
        });
      } else {
        stripeAccount = await stripeApi.createAccount({
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
        });
        if (stripeAccount) {
          await dbClient("users")
            .update({ stripe_account_id: stripeAccount.id })
            .where("id", id);
        }
      }

      if (!stripeAccount)
        throw new GraphQLError(
          "Unexpected error trying to create a Stripe account!"
        );

      const stripeAccountLink = await stripeApi.createAccountLink({
        accountId: stripeAccount.id,
      });

      if (!stripeAccountLink)
        throw new GraphQLError(
          "Unexpected error trying to create a Stripe account link!"
        );

      return {
        message: "Follow the redirect link to connect your Stripe account!",
        redirect: stripeAccountLink.url,
      };
    } catch (err) {
      logger.error("Connect Stripe Account Resolver Error", err);
      throw new GraphQLError(
        "Unexpected error trying to connect a Stripe account"
      );
    }
  },
};

export { userFields, userQueries, userMutations };
