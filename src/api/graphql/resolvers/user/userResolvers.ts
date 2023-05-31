import { GraphQLError } from "graphql";
import bcrypt from "bcrypt";

import {
  loginValidationSchema,
  createAccountValidationSchema,
} from "./userValidation";
import { isLoggedIn } from "../../../middleware/auth";
import { handleGraphqlError } from "../../../../utils/api";

import {
  User,
  Event,
  Payment,
  EventType,
  GraphQlContext,
  TUserSessionData,
} from "../../../../types";

interface CreateAccountInputParams {
  params: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
}

interface LoginParams {
  email: string;
  password: string;
}

interface CreateAccountResponse {
  message: string;
}

interface LoginResponse {
  message: string;
  is2FaActivated: boolean;
}

interface ConnectResponse {
  message: string;
  redirect: string;
}

const userFields = {
  User: {
    fullName: (parent: User) => `${parent.first_name} ${parent.last_name}`,
    isVerified: (parent: User) => parent.is_email_verified,
    is2FaActivated: (parent: User) => parent.is_2fa_activated,
    createdAt: (parent: User) => parent.created_at,
    upcomingEvents: async (
      parent: User,
      _: any,
      ctx: GraphQlContext
    ): Promise<Event[]> => {
      try {
        const { id } = parent;
        const { dbClient } = ctx.services;

        const upcomingEvents = (await dbClient("events")
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
          .limit(3)) as Event[];

        return upcomingEvents;
      } catch (err) {
        return handleGraphqlError(err, {
          server: "User.upcomingEvents resolver error",
          client: "Unexpected error trying to retrieve user's upcoming events!",
        });
      }
    },
    recentEventTypes: async (
      parent: User,
      _: any,
      ctx: GraphQlContext
    ): Promise<EventType[]> => {
      try {
        const { id } = parent;
        const { dbClient } = ctx.services;

        const recentEventTypes = await dbClient("event_types")
          .select("*")
          .where("user_id", id)
          .orderBy("updated_at", "desc")
          .limit(3);

        return recentEventTypes;
      } catch (err) {
        return handleGraphqlError(err, {
          server: "User.recentEventTypes resolver error",
          client:
            "Unexpected error trying to retrieve user's recently updated event types!",
        });
      }
    },
    recentPayments: async (
      parent: User,
      _: any,
      ctx: GraphQlContext
    ): Promise<Payment[]> => {
      try {
        const { id } = parent;
        const { dbClient } = ctx.services;

        const recentPayments = await dbClient("payments")
          .select("*")
          .where("user_id", id)
          .orderBy("created_at", "desc")
          .limit(3);

        return recentPayments;
      } catch (err) {
        return handleGraphqlError(err, {
          server: "User.recentPayments resolver error",
          client:
            "Unexpected error trying to retrieve user's most recently received payments!",
        });
      }
    },
  },
};

const userQueries = {
  me: async (_: any, __: any, ctx: GraphQlContext): Promise<User> => {
    const { req } = ctx;
    const { dbClient } = ctx.services;
    if (!isLoggedIn(req)) throw new GraphQLError("You are not authenticated!");

    const { id } = req.session.user as TUserSessionData;

    try {
      const user = (await dbClient("users").select("*").where({ id }))[0];
      return user;
    } catch (err) {
      return handleGraphqlError(err, {
        server: "User.me resolver error",
        client:
          "Unexpected error trying to retrieve your account's information!",
      });
    }
  },
};

const userMutations = {
  createAccount: async (
    _: any,
    params: CreateAccountInputParams,
    ctx: GraphQlContext
  ): Promise<CreateAccountResponse> => {
    try {
      const { params: createParams } = params;
      await createAccountValidationSchema.validateAsync(createParams);

      const { dbClient, emailApi } = ctx.services;
      const { username, email, password, firstName, lastName } = createParams;

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

      emailApi.sendMail({
        to: email,
        type: "VERIFY_EMAIL",
        payload: { userFirstName: firstName, username },
      });

      return {
        message:
          "You have succesfully created an account. You can now login using your email and password!",
      };
    } catch (err) {
      return handleGraphqlError(err, {
        server: "User.createAccount resolver error",
        client: "Unexpected error trying to create an account!",
      });
    }
  },
  login: async (
    _: any,
    params: LoginParams,
    ctx: GraphQlContext
  ): Promise<LoginResponse> => {
    try {
      const { req } = ctx;

      await loginValidationSchema.validateAsync(params);
      const { email, password } = params;

      const { dbClient, emailApi } = ctx.services;

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
        // create session
        req.session.user = {} as TUserSessionData;
        req.session.user.id = loggedAccount.id;
        req.session.user.email = loggedAccount.email;
      } else {
        message =
          "Your account has 2-factor auth enabled. Check your email address for the access link you must click to login!";
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
      return handleGraphqlError(err, {
        server: "User.login resolver error",
        client: "Unexpected error trying to login into account!",
      });
    }
  },
  activate2Fa: async (_: any, __: any, ctx: GraphQlContext): Promise<User> => {
    const { req } = ctx;
    const { dbClient } = ctx.services;

    if (!isLoggedIn(req)) throw new GraphQLError("You are not authenticated!");

    const { id } = ctx.req.session.user as TUserSessionData;

    try {
      await dbClient("users")
        .update({ is_2fa_activated: true })
        .where("id", id);

      const updatedUser = (
        await dbClient("users").select("*").where("id", id)
      )[0];

      return updatedUser;
    } catch (err) {
      return handleGraphqlError(err, {
        server: "User.activate2Fa resolver error",
        client: "Unexpected error trying to activate 2-factor authentication!",
      });
    }
  },
  connectGoogleCalendar: async (
    _: any,
    __: any,
    ctx: GraphQlContext
  ): Promise<ConnectResponse> => {
    try {
      const { req } = ctx;
      const { oAuthApi } = ctx.services;

      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");

      const { dbClient } = ctx.services;

      const { id } = ctx.req.session.user as TUserSessionData;
      const googleConnectionList = await dbClient("oauth_connections")
        .select("user_id")
        .where("user_id", id)
        .andWhere("provider", "GOOGLE");
      if (googleConnectionList.length)
        throw new GraphQLError("You are already connected to Google!");

      const authState = { userId: id };
      const encodedState = Buffer.from(JSON.stringify(authState)).toString(
        "base64url"
      );

      let authUrl = oAuthApi.generateOAuthUrl();
      authUrl += `state=${encodedState}`;

      return {
        message: "Follow the redirect link to connect to your Google Calendar!",
        redirect: authUrl,
      };
    } catch (err) {
      return handleGraphqlError(err, {
        server: "User.connectGoogleCalendar resolver error",
        client: "Unexpected error trying to connect to Google Calendar!",
      });
    }
  },
  connectStripe: async (
    _: any,
    __: any,
    ctx: GraphQlContext
  ): Promise<ConnectResponse> => {
    const { req } = ctx;
    const { dbClient, stripeApi } = ctx.services;

    if (!isLoggedIn(req)) throw new GraphQLError("You are not authenticated!");

    const { id } = ctx.req.session.user as TUserSessionData;

    try {
      const user = (await dbClient("users").select("*").where("id", id))[0];

      let stripeAccountId: string;

      if (user.stripe_account_id) {
        // stripe account already exists
        stripeAccountId = user.stripe_account_id;
        const areDetailsSubmitted = (
          await dbClient("stripe_accounts")
            .select("details_submitted")
            .where("id", user.stripe_account_id)
        )[0].details_submitted;
        if (areDetailsSubmitted)
          throw new GraphQLError("You are already connected to Stripe!");
      } else {
        const stripeAccount = await stripeApi.createAccount({
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
        });

        await dbClient("stripe_accounts").insert({
          id: stripeAccount.id,
        });

        await dbClient("users")
          .update({ stripe_account_id: stripeAccount.id })
          .where("id", id);

        stripeAccountId = stripeAccount.id;
      }

      const stripeAccountLink = await stripeApi.createAccountLink({
        accountId: stripeAccountId,
      });
      return {
        message: "Follow the redirect link to connect to your Stripe Account!",
        redirect: stripeAccountLink.url,
      };
    } catch (err) {
      return handleGraphqlError(err, {
        server: "User.connectStripe resolver error",
        client: "Unexpected error trying to connect to Stripe!",
      });
    }
  },
};

export { userFields, userQueries, userMutations };
