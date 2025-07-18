const winston = require("winston");
const path = require("path");

const logFilePath = path.join(__dirname, "../logs/app.log");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: logFilePath })
  ],
});

module.exports = { logger, logFilePath };
