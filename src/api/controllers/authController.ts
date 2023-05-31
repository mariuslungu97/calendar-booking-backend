import { Request, Response } from "express";
import jwt from "jsonwebtoken";

import logger from "../../loaders/logger";
import knex from "../../loaders/knex";

import { decodeJwtString } from "../../utils";
import { TUserSessionData } from "../../types";

interface EmailVerificationPayload {
  username: string;
}

interface TwoFactorAuthPayload {
  username: string;
}

interface AuthCallbackParams {
  token?: string;
}

const emailVerificationCallbackHandler = async (
  req: Request<AuthCallbackParams>,
  res: Response
) => {
  try {
    const { token } = req.params;
    if (!token)
      return res.status(400).json({
        message: "The request does not include the expected query params!",
      });

    const decodedPayload = (await decodeJwtString(token)) as jwt.JwtPayload &
      EmailVerificationPayload;

    const { username } = decodedPayload;

    const userList = await knex("users")
      .select("id")
      .where("username", username);
    if (!userList.length) {
      res
        .status(500)
        .json({ message: "Unexpected error trying to verify user" });
      throw new Error(
        "Email Verification callback handler: cannot find user by using decoded username!"
      );
    }

    await knex("users")
      .update({ is_email_verified: true })
      .where("id", userList[0].id);

    return res
      .status(200)
      .json({ message: "Your account's email has been verified!" });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res
        .status(401)
        .json({ message: "You are not authorised to perform this action!" });
    }
    logger.error(err);
    throw err;
  }
};

const twoFaLoginCallbackHandler = async (
  req: Request<AuthCallbackParams>,
  res: Response
) => {
  try {
    const { token } = req.params;
    if (!token)
      return res.status(400).json({
        message: "The request does not include the expected query params!",
      });

    const decodedPayload = (await decodeJwtString(token)) as jwt.JwtPayload &
      TwoFactorAuthPayload;

    const { username } = decodedPayload;

    const userList = await knex("users")
      .select("id", "email")
      .where("username", username);
    if (!userList.length) {
      res
        .status(500)
        .json({ message: "Unexpected error trying to verify user" });
      throw new Error(
        "Email Verification callback handler: cannot find user by using decoded username!"
      );
    }

    req.session.user = {} as TUserSessionData;
    req.session.user.email = userList[0].email;
    req.session.user.id = userList[0].id;

    return res.status(200).json({ message: "You are now logged in!" });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res
        .status(401)
        .json({ message: "You are not authorised to perform this action!" });
    }
    logger.error(err);
    throw err;
  }
};

export { emailVerificationCallbackHandler, twoFaLoginCallbackHandler };
