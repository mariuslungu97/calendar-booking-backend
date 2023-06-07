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
import { paymentFields, paymentQueries } from "./payment/paymentResolvers";

const rootQueries = {
  ...userQueries,
  ...eventTypeQueries,
  ...eventQueries,
  ...paymentQueries,
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
  ...paymentFields,
  Query: rootQueries,
  Mutation: rootMutations,
};

export default rootResolvers;
