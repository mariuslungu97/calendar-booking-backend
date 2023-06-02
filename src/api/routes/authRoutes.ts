import express from "express";

import config from "../../config";

import {
  twoFaLoginCallbackHandler,
  emailVerificationCallbackHandler,
} from "../controllers/authController";

const { authTwoFactorUri, authEmailVerifyUri } = config.app;

const authRouter = express.Router();

authRouter.get(authTwoFactorUri, twoFaLoginCallbackHandler);
authRouter.get(authEmailVerifyUri, emailVerificationCallbackHandler);

export default authRouter;
