import path from "path";
import { createLogger, format, transports } from "winston";
import { getProjectRoot } from "./utils";

const logFormat = format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

const logger = createLogger({
  level: process.env.NRG_LOG_LEVEL || "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
    logFormat,
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.printf(({ level, message, timestamp }) => {
          return `${timestamp} [${level}]: ${message}`;
        }),
      ),
    }),
    new transports.File({
      filename: path.resolve(getProjectRoot(), "logs", "nrg.log"),
      level: "silly",
      format: format.combine(format.uncolorize(), logFormat),
    }),
  ],
});

export default logger;
