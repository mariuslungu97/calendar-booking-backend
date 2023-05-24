import { createYoga, createSchema } from "graphql-yoga";

import config from "../config";

import graphQlTypeDefs from "../api/graphql/types";
import rootResolvers from "../api/graphql/resolvers";

const { path } = config.graphql;

const schema = createSchema({
  typeDefs: graphQlTypeDefs,
  resolvers: rootResolvers,
});

const yoga = createYoga({ schema, graphqlEndpoint: path });

export default yoga;
