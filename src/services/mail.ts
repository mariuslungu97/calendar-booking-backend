import { Queue, ConnectionOptions } from "bullmq";
import logger from "../loaders/logger";

import config from "../config";

import { IMailService, TSendMailParams, TMailJobData } from "../types";

const { host, port, user, password } = config.redis;
const connection: ConnectionOptions = {
  host,
  port,
  password,
  username: user,
};

const emailsTransportQueue = new Queue<TMailJobData>("emailsTransport", {
  connection,
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
