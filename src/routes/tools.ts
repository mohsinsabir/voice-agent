import type { FastifyPluginAsync } from "fastify";
import { requireToolSecret } from "../middleware/tool-auth.js";
import { dispatchTool } from "../tools/handlers.js";
import type { ToolRequest } from "../tools/types.js";
import { logger } from "../config/logger.js";

/** Retell may put LLM params under `args` or at the top level (when "args only" is off). */
function extractArgs(body: Record<string, unknown>): Record<string, unknown> {
  const nested =
    body.args && typeof body.args === "object" && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : {};
  const {
    call: _c,
    name: _n,
    args: _a,
    agent_id: _ag,
    tool_call_id: _t,
    ...topLevel
  } = body;
  return { ...topLevel, ...nested };
}

export const toolRoutes: FastifyPluginAsync = async (app) => {
  app.post("/tools", async (request, reply) => {
    if (!requireToolSecret(request, reply)) return;

    const body = request.body as ToolRequest & Record<string, unknown>;
    if (!body?.call?.call_id || !body?.name) {
      return reply.status(200).send({
        result: {
          success: false,
          error: { code: "INVALID_INPUT", message: "call.call_id and name are required" },
        },
      });
    }

    const args = extractArgs(body);
    const started = Date.now();
    const result = await dispatchTool({
      call: body.call,
      name: body.name,
      args,
    });

    logger.info(
      {
        tool: body.name,
        callId: body.call.call_id,
        argKeys: Object.keys(args),
        success: result.result.success !== false,
        latencyMs: Date.now() - started,
        requestId: request.requestId,
      },
      "Tool invocation",
    );

    return reply.status(200).send(result);
  });
};
