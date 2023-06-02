import { createLogger, transports, format } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
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

const consoleTransport = new transports.Console({
  level: logLevel,
  format: format.combine(format.colorize({ all: true }), format.padLevels()),
});

const dailyRotateFileTransport = new DailyRotateFile({
  level: logLevel,
  filename: dir + "/%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  handleExceptions: true,
  maxSize: "20m",
  maxFiles: "14d",
});

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.ms(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [consoleTransport, dailyRotateFileTransport],
  exitOnError: false, // do not exit on handled exceptions
});

export default logger;
