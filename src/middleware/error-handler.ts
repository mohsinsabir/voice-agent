import type { FastifyError, FastifyPluginAsync } from "fastify";
import { logger } from "../config/logger.js";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode =
      error instanceof AppError
        ? error.statusCode
        : typeof error.statusCode === "number"
          ? error.statusCode
          : 500;

    const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";

    logger.error(
      {
        err: error,
        requestId: request.requestId,
        path: request.url,
        method: request.method,
      },
      error.message,
    );

    if (reply.sent) return;

    reply.status(statusCode).send({
      error: {
        code,
        message: statusCode >= 500 ? "Internal server error" : error.message,
        requestId: request.requestId,
      },
    });
  });
};
