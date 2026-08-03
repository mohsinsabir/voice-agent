import type { FastifyPluginAsync } from "fastify";
import { requireToolSecret } from "../middleware/tool-auth.js";
import { dispatchTool } from "../tools/handlers.js";
import type { ToolRequest } from "../tools/types.js";
import { logger } from "../config/logger.js";

export const toolRoutes: FastifyPluginAsync = async (app) => {
  app.post("/tools", async (request, reply) => {
    if (!requireToolSecret(request, reply)) return;

    const body = request.body as ToolRequest;
    if (!body?.call?.call_id || !body?.name) {
      return reply.status(200).send({
        result: {
          success: false,
          error: { code: "INVALID_INPUT", message: "call.call_id and name are required" },
        },
      });
    }

    const started = Date.now();
    const result = await dispatchTool({
      call: body.call,
      name: body.name,
      args: body.args ?? {},
    });

    logger.info(
      {
        tool: body.name,
        callId: body.call.call_id,
        success: result.result.success !== false,
        latencyMs: Date.now() - started,
        requestId: request.requestId,
      },
      "Tool invocation",
    );

    return reply.status(200).send(result);
  });
};
