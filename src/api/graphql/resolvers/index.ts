import { userFields, userQueries, userMutations } from "./user/userResolvers";
import {
  eventTypeFields,
  eventTypeQueries,
  eventTypeMutations,
} from "./eventType/eventTypeResolvers";
import {
  eventFields,
  eventQueries,
  eventMutations,
} from "./event/eventResolvers";

const rootQueries = {
  ...userQueries,
  ...eventTypeQueries,
  ...eventQueries,
};
const rootMutations = {
  ...userMutations,
  ...eventTypeMutations,
  ...eventMutations,
};

const rootResolvers = {
  ...userFields,
  ...eventTypeFields,
  ...eventFields,
  Query: rootQueries,
  Mutation: rootMutations,
};

export default rootResolvers;
