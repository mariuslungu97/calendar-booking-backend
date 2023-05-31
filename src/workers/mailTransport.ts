import { Worker, Job } from "bullmq";
import handlebars from "handlebars";

import getTransporter from "../loaders/nodemailer";
import redisConnection from "../loaders/redis";
import logger from "../loaders/logger";

import {
  readHTMLFile,
  generateJwtLink,
  generateMailFields,
} from "../utils/mail";

import { TMailJobData } from "../types";

const process = async (job: Job<TMailJobData>) => {
  const { to, type, payload } = job.data;

  const {
    subject,
    linkUri,
    linkExpirationDate,
    htmlFilePath,
    jwtPayload,
    htmlReplacements,
  } = generateMailFields(type, payload);

  try {
    const html = await readHTMLFile(htmlFilePath);

    let allHtmlReplacements = { ...htmlReplacements };
    if (type !== "CANCEL_EVENT") {
      const jwtToken = await generateJwtLink(jwtPayload, linkExpirationDate);

      const link = linkUri + jwtToken;
      allHtmlReplacements = { ...htmlReplacements, link };
    }

    const htmlTemplate = handlebars.compile(html);
    const htmlToSend = htmlTemplate(allHtmlReplacements);
    const transporter = await getTransporter();
    await transporter.sendMail({
      to,
      subject,
      html: htmlToSend,
    });

    return;
  } catch (err) {
    logger.info(
      "Encountered an error whilst processing mail transport job",
      err
    );
    throw err;
  }
};

const mailTransportWorker = new Worker("emailsTransport", process, {
  autorun: false,
  concurrency: 2,
  connection: redisConnection(),
});

export default mailTransportWorker;
