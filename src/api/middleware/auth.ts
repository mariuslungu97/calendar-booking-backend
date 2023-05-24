import { Request } from "express";

const isLoggedIn = (req: Request) => {
  if (!req.session || !req.session.user) return false;

  return true;
};

export { isLoggedIn };
