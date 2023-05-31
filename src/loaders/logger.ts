import { createLogger, transports, format } from "winston";
import fs from "fs";
import path from "path";

import config from "../config";

// logs directory
let dir = path.resolve(process.cwd(), "logs");

// create directory if it is not present
if (!fs.existsSync(dir)) {
  // Create the directory if it does not exist
  fs.mkdirSync(dir);
}

const logLevel = config.app.isDev ? "debug" : "warn";

// NOTE using this transport breaks the logging to the console
// const dailyRotateFileTransport = new DailyRotateFile({
//   level: logLevel,
//   filename: dir + "/%DATE%.log",
//   datePattern: "YYYY-MM-DD",
//   zippedArchive: true,
//   handleExceptions: true,
//   maxSize: "20m",
//   maxFiles: "14d",
//   format: format.combine(
//     format.errors({ stack: true }),
//     format.timestamp(),
//     format.json()
//   ),
// });

const consoleTransport = new transports.Console({
  level: logLevel,
  format: format.combine(format.errors({ stack: true }), format.prettyPrint()),
});

const logger = createLogger({
  transports: [consoleTransport],
  exitOnError: false, // do not exit on handled exceptions
});

export default logger;
