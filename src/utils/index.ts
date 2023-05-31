import jwt from "jsonwebtoken";
import config from "../config";

const { jwtSecret } = config.app;

const signPayloadJwt = (
  payload: object,
  expirationDate: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: expirationDate },
      (error, token) => {
        if (error || !token) {
          if (!token) reject(new Error("Couldn't retrieve token!"));
          else reject(error);
        } else resolve(token);
      }
    );
  });
};

const decodeJwtString = (
  encodedJwt: string
): Promise<string | jwt.JwtPayload> => {
  return new Promise((resolve, reject) => {
    jwt.verify(encodedJwt, jwtSecret, (err, decoded) => {
      if (err || !decoded) {
        if (!decoded) reject(new Error("Couldn't retrieve decoded!"));
        else reject(err);
      } else resolve(decoded);
    });
  });
};

const randomString = (length: number) => {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
};

// https://stackoverflow.com/questions/44115681/javascript-check-if-timezone-name-valid-or-not
const isValidTimeZone = (tz: string) => {
  if (!Intl || !Intl.DateTimeFormat().resolvedOptions().timeZone) {
    throw new Error("Time zones are not available in this environment");
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (ex) {
    return false;
  }
};

const areArraysEqual = (arr1: number[], arr2: number[]) => {
  if (arr1 === arr2) return true;
  if (arr1 == null || arr2 == null) return false;
  if (arr1.length !== arr2.length) return false;

  for (var i = 0; i < arr1.length; ++i) {
    if (arr1[i] !== arr2[i]) return false;
  }

  return true;
};

export {
  signPayloadJwt,
  decodeJwtString,
  randomString,
  isValidTimeZone,
  areArraysEqual,
};
