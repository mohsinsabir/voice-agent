import type { FastifyPluginAsync } from "fastify";
import { getEnv } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../middleware/error-handler.js";

export const webCallRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/web-call", async (_request, reply) => {
    const env = getEnv();

    if (!env.ENABLE_RETELL || !env.RETELL_API_KEY || !env.RETELL_AGENT_ID) {
      throw new AppError(
        503,
        "Retell web call is not configured (ENABLE_RETELL, RETELL_API_KEY, RETELL_AGENT_ID)",
        "RETELL_NOT_CONFIGURED",
      );
    }

    const response = await fetch("https://api.retellai.com/v2/create-web-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: env.RETELL_AGENT_ID,
        metadata: {
          business: env.DEFAULT_BUSINESS_NAME,
          source: "web_frontend",
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body }, "Retell create-web-call failed");
      throw new AppError(502, "Failed to create Retell web call", "RETELL_CREATE_FAILED");
    }

    const call = (await response.json()) as {
      access_token: string;
      call_id: string;
      agent_id: string;
    };

    logger.info({ callId: call.call_id, agentId: call.agent_id }, "Created Retell web call");

    return reply.status(201).send({
      accessToken: call.access_token,
      callId: call.call_id,
      agentId: call.agent_id,
    });
  });
};
