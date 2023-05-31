import { createYoga, createSchema, YogaInitialContext } from "graphql-yoga";
import { Request, Response } from "express";

import config from "../config";

import knexClient from "./knex";
import calendarApi from "../services/googleCalendar";
import googleAuthStore from "../services/googleAuthClients";
import mailService from "../services/mail";
import oAuthApi from "../services/googleOAuth";
import stripeApi from "../services/stripe";
import graphQlTypeDefs from "../api/graphql/types";
import rootResolvers from "../api/graphql/resolvers";

import { isLoggedIn } from "../api/middleware/auth";

import { GraphQlContext, TUserSessionData } from "../types";

const { path } = config.graphql;

const schema = createSchema({
  typeDefs: graphQlTypeDefs,
  resolvers: rootResolvers,
});

const yoga = createYoga({
  schema,
  graphqlEndpoint: path,
  cors: {
    origin: "*",
    methods: ["POST"],
  },
  context: (yogaContext) => {
    const { req, res } = yogaContext as YogaInitialContext & {
      req: Request;
      res: Response;
    };

    const loggedIn = isLoggedIn(req);
    const oAuthClient = loggedIn
      ? googleAuthStore.getClient((req.session.user as TUserSessionData).id)
      : null;

    const context: GraphQlContext = {
      req,
      res,
      services: {
        oAuthApi,
        stripeApi,
        dbClient: knexClient,
        emailApi: mailService,
        oAuthStoreApi: googleAuthStore,
        googleCalendarApi: oAuthClient ? calendarApi(oAuthClient) : null,
      },
    };

    return context as any;
  },
});

export default yoga;
