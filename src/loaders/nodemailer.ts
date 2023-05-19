import nodemailer from "nodemailer";

import logger from "./logger";
import config from "../config";

let { host, port, user, pass } = config.smtp;

let transporter: nodemailer.Transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (!host) host = "smtp.ethereal.email";
  if (!port) port = 587;

  if (!user || !pass) {
    const testAccount = await nodemailer.createTestAccount();
    logger.info(
      `Create mail transporter test SMTP account with \n user: ${user}\npass: ${pass}`
    );
    user = testAccount.user;
    pass = testAccount.pass;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465 ? true : false,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
};

export default getTransporter;
