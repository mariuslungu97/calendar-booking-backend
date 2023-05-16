import { Request, NextFunction } from "express";

import { RestApiError } from "../../types";

const isLoggedIn = (req: Request, _: any, next: NextFunction) => {
  if (!req.session.user)
    throw new RestApiError("You are not authenticated!", "UNAUTHENTICATED");

  return next();
};

export { isLoggedIn };
