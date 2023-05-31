import fs from "fs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import config from "../config";

import {
  TSendMailType,
  TSendMailPayload,
  TVerifyEmailPayload,
  TCancelEventPayload,
  TEventNotifyUpdatePayload,
  TEventConfirmationPayload,
  TTwoFactorAuthPayload,
} from "../types";

type TGenMailFieldsResponse = {
  linkUri: string;
  linkExpirationDate: number;
  htmlFilePath: string;
  subject: string;
  jwtPayload: object;
  htmlReplacements: object;
};

dayjs.extend(utc);
dayjs.extend(timezone);

const { name, uri } = config.app;

const readHTMLFile = async (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, { encoding: "utf-8", flag: "r" }, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
};

const formatMailDate = (
  startDateStr: string,
  endDateStr: string,
  timezone: string
) => {
  const startDate = dayjs(startDateStr).tz(timezone);
  const endDate = dayjs(endDateStr).tz(timezone);
  const areDatesEqual = endDate.isSame(startDate, "date");
  const dateFormat = `${startDate.format("HH:mm")} - ${endDate.format(
    "HH:mm"
  )}, ${
    areDatesEqual
      ? `${endDate.format("dddd, MMMM D, YYYY")}`
      : `${startDate.format(
          `dddd to ${endDate.format("dddd")}, MMMM D - ${endDate.format("D")}, YYYY` // prettier-ignore
        )}`
  }`;

  return dateFormat;
};

const generateMailFields = (
  type: TSendMailType,
  payload: TSendMailPayload
): TGenMailFieldsResponse => {
  let subject = "";
  let linkUri = uri;
  let htmlFilePath = __dirname + "/../mail_templates/";
  let linkExpirationDate = 60 * 10; // seconds
  let htmlReplacements = {},
    jwtPayload = {};

  if (type === "VERIFY_EMAIL") {
    const typedPayload = payload as TVerifyEmailPayload;
    const { username, userFirstName } = typedPayload;

    linkUri += "/accounts/verify?token=";
    subject = `${name} - Verify Your Email Address`;
    htmlFilePath += "verifyEmail.html";
    linkExpirationDate = 60 * 60 * 48; // 48 hours

    jwtPayload = { username };
    htmlReplacements = {
      appName: name,
      userFirstName,
      title: "Verify Your Email Address",
    };
  } else if (type === "EVENT_CONFIRMATION") {
    const typedPayload = payload as TEventConfirmationPayload;
    const {eventId, eventTypeName, eventDateTime, eventLocation, displayTimezone} = typedPayload; // prettier-ignore
    const { start, end } = eventDateTime;

    linkUri += "/events/cancel?token=";
    subject = `${name} - Event Confirmation Receipt`;
    htmlFilePath += "confirmEvent.html";
    linkExpirationDate = dayjs(start)
      .subtract(1, "hour")
      .diff(dayjs(), "second"); // link expires 1 hour before event starts

    jwtPayload = { eventId };
    htmlReplacements = {
      title: "Event Confirmation Receipt",
      eventType: eventTypeName,
      date: formatMailDate(start, end, displayTimezone),
      timezone: displayTimezone,
      location: eventLocation,
      appName: name,
    };
  } else if (type === "NOTIFY_EVENT_UPDATE") {
    const typedPayload = payload as TEventNotifyUpdatePayload;
    const {eventId, eventTypeName, eventLocation, newDateTime, pastDateTime, displayTimezone} = typedPayload; // prettier-ignore
    const { start: startPastDateTime, end: endPastDateTime } = pastDateTime;
    const { start: startNewDateTime, end: endNewDateTime } = newDateTime;

    linkUri += "/events/cancel?token=";
    subject = `${name} - Event Update Notification Receipt`;
    htmlFilePath += "updateEvent.html";
    linkExpirationDate = dayjs(startNewDateTime)
      .subtract(1, "hour")
      .diff(dayjs(), "second");

    jwtPayload = { eventId };
    htmlReplacements = {
      title: "Event Confirmation Receipt",
      eventType: eventTypeName,
      pastDate: formatMailDate(
        startPastDateTime,
        endPastDateTime,
        displayTimezone
      ),
      newDate: formatMailDate(
        startNewDateTime,
        endNewDateTime,
        displayTimezone
      ),
      timezone: displayTimezone,
      location: eventLocation,
      appName: name,
    };
  } else if (type === "TWO_FACTOR_AUTH") {
    const typedPayload = payload as TTwoFactorAuthPayload;
    const { username, userFirstName } = typedPayload;

    linkUri += "/login/2fa?token=";
    subject = `${name} - 2FA Authentication Link`;
    htmlFilePath += "twoFactor.html";
    linkExpirationDate = 60 * 10;

    jwtPayload = { username };
    htmlReplacements = { userFirstName };
  } else if (type === "CANCEL_EVENT") {
    const typedPayload = payload as TCancelEventPayload;
    const { eventTypeName, userFullName, displayTimezone, eventDateTime } =
      typedPayload;

    subject = `${name} - Cancelled Event`;
    htmlFilePath += "cancelEvent.html";
    htmlReplacements = {
      userFullName,
      title: `${eventTypeName} has been cancelled!`,
      date: formatMailDate(
        eventDateTime.start,
        eventDateTime.end,
        displayTimezone
      ),
    };
  }

  return {
    subject,
    linkUri,
    linkExpirationDate,
    htmlFilePath,
    jwtPayload,
    htmlReplacements,
  };
};

export { readHTMLFile, formatMailDate, generateMailFields };
