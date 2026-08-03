import type { FastifyReply, FastifyRequest } from "fastify";
import { getEnv } from "../config/env.js";

export function requireToolSecret(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  const env = getEnv();
  const expected = env.RETELL_TOOL_SECRET;
  if (!expected) {
    void reply.status(503).send({
      error: {
        code: "TOOL_SECRET_NOT_CONFIGURED",
        message: "RETELL_TOOL_SECRET is not set",
      },
    });
    return false;
  }

  const provided = request.headers["x-internal-tool-secret"];
  if (typeof provided !== "string" || provided !== expected) {
    void reply.status(401).send({
      error: { code: "UNAUTHORIZED", message: "Invalid tool secret" },
    });
    return false;
  }
  return true;
}
