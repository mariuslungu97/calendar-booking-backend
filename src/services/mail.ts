import { Queue } from "bullmq";
import logger from "../loaders/logger";
import redisConnection from "../loaders/redis";

import { IMailService, TSendMailParams, TMailJobData } from "../types";

const emailsTransportQueue = new Queue<TMailJobData>("emailsTransport", {
  connection: redisConnection(),
});

const sendMail = async (params: TSendMailParams) => {
  const { to, type } = params;

  logger.info(`Sending ${type} email to ${to}`);

  await emailsTransportQueue.add("transport", params);
};

const mailService: IMailService = {
  sendMail,
};

export default mailService;
