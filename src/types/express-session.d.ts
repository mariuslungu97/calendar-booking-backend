import { TUserSessionData } from "../types";

declare module "express-session" {
  interface SessionData {
    user: TUserSessionData;
  }
}
