import express from "express";

import {
  twoFaLoginCallbackHandler,
  emailVerificationCallbackHandler,
} from "../controllers/authController";

const authRouter = express.Router();

authRouter.post("auth/2fa", twoFaLoginCallbackHandler);
authRouter.get("/auth/email", emailVerificationCallbackHandler);

export default authRouter;
