import Stripe from "stripe";
import dayjs from "dayjs";

import { isLoggedIn } from "../../../middleware/auth";
import { cursorPaginationParamsValidationSchema } from "../validation";
import { parsePaginationCursor } from "../../../../utils/api";
import { handleGraphqlError } from "../../../../utils/api";

import {
  CursorPaginationParams,
  GraphQlContext,
  PageInfo,
  Payment,
  TUserSessionData,
} from "../../../../types";
import { GraphQLError } from "graphql";

interface PaymentConnections {
  pageInfo: PageInfo;
  edges: Payment[];
}

const paymentFields = {
  totalFee: (parent: Payment) => parent.total_fee,
  applicationFee: (parent: Payment) => parent.application_fee,
  createdAt: (parent: Payment) => parent.created_at,
  updatedAt: (parent: Payment) => parent.updated_at,
  currency: (parent: Payment) => {
    const sessionPayload = JSON.parse(
      parent.processor_payload
    ) as Stripe.Checkout.Session;
    return sessionPayload.currency;
  },
  customerName: (parent: Payment) => {
    const sessionPayload = JSON.parse(
      parent.processor_payload
    ) as Stripe.Checkout.Session;
    return sessionPayload.customer_details?.name || null;
  },
  customerEmail: (parent: Payment) => {
    const sessionPayload = JSON.parse(
      parent.processor_payload
    ) as Stripe.Checkout.Session;
    return sessionPayload.customer_email;
  },
};

const paymentQueries = {
  payments: async (
    _: any,
    params: CursorPaginationParams,
    ctx: GraphQlContext
  ): Promise<PaymentConnections> => {
    try {
      const { req } = ctx;
      if (!isLoggedIn(req))
        throw new GraphQLError("You are not authenticated!");
      const { id: userId } = req.session.user as TUserSessionData;

      await cursorPaginationParamsValidationSchema.validateAsync(params);

      const { dbClient } = ctx.services;
      const { cursor, order, take } = params;

      let isNext = true;
      let timestamp = "";
      let operator = "<"; // based on isNext == true && order == "DESC"

      if (cursor !== "") {
        const decodedCursorResponse = parsePaginationCursor(cursor);
        isNext = decodedCursorResponse[0];
        timestamp = decodedCursorResponse[1];
      }

      if (isNext && order === "ASC") operator = ">";
      else if (!isNext && order === "ASC") operator = "<";
      else if (isNext && order === "DESC") operator = "<";
      else if (!isNext && order === "DESC") operator = ">";

      const paymentsQuery = dbClient("payments")
        .select("*")
        .where("user_id", userId)
        .orderBy("updated_at", order)
        .limit(take);

      if (timestamp !== "")
        paymentsQuery.andWhere("updated_at", operator, timestamp);

      const payments = await paymentsQuery;

      if (!payments.length)
        return {
          pageInfo: { nextPage: null, previousPage: null, order, take },
          edges: [],
        };

      const firstPayment = payments[0];
      const lastPayment = payments[payments.length - 1];

      const prevOperator = order === "DESC" ? ">" : "<";
      const prevEventType = await dbClient("payments")
        .select("updated_at")
        .where("user_id", userId)
        .andWhere("updated_at", prevOperator, firstPayment.updated_at)
        .orderBy("updated_at", order)
        .limit(1);
      const nextEventType = await dbClient("payments")
        .select("updated_at")
        .where("user_id", userId)
        .andWhere("updated_at", operator, lastPayment.updated_at)
        .orderBy("updated_at", order)
        .limit(1);

      const pageInfo: PageInfo = {
        nextPage: nextEventType.length
          ? Buffer.from(
              `next__${dayjs(lastPayment.updated_at).unix()}`,
              "ascii"
            ).toString("base64")
          : null,
        previousPage: prevEventType.length
          ? Buffer.from(
              `prev__${dayjs(firstPayment.updated_at).unix()}`,
              "ascii"
            ).toString("base64")
          : null,
        order,
        take,
      };

      return {
        pageInfo: pageInfo,
        edges: payments,
      };
    } catch (err) {
      return handleGraphqlError(err, {
        client: "Unexpected error trying to retrieve payments!",
        server: "Payment.payments resolver error",
      });
    }
  },
};

export { paymentFields, paymentQueries };
