import pino from "pino";
import { getEnv } from "./env.js";

const REDACT_PATHS = [
  "password",
  "password_hash",
  "req.headers.authorization",
  'req.headers["x-internal-tool-secret"]',
  'req.headers["x-automation-secret"]',
  'req.headers["x-retell-signature"]',
  "*.private_key",
  "*.TWILIO_AUTH_TOKEN",
  "*.SENDGRID_API_KEY",
  "*.RETELL_API_KEY",
  "*.HUBSPOT_ACCESS_TOKEN",
  "*.DATABASE_URL",
];

export function createLogger(name?: string) {
  const env = getEnv();
  const options: pino.LoggerOptions = {
    level: env.LOG_LEVEL,
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
  };
  if (name) {
    options.name = name;
  }
  if (env.NODE_ENV === "development") {
    options.transport = {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    };
  }
  return pino(options);
}

export const logger = createLogger("voice-agent");
