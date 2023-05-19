import { Worker, Job } from "bullmq";
import handlebars from "handlebars";
import getTransporter from "../loaders/nodemailer";

import {
  readHTMLFile,
  generateJwtLink,
  generateMailFields,
} from "../utils/mail";

import { TMailJobData } from "../types";
import logger from "../loaders/logger";

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

    const jwtToken = await generateJwtLink(jwtPayload, linkExpirationDate);

    const link = linkUri + jwtToken;
    const allhtmlReplacements = { ...htmlReplacements, link };

    const htmlTemplate = handlebars.compile(html);
    const htmlToSend = htmlTemplate(allhtmlReplacements);
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
});

export default mailTransportWorker;