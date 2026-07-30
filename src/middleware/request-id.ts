import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

export const requestIdPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    const incoming = request.headers["x-request-id"];
    const requestId = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    request.requestId = requestId;
    reply.header("x-request-id", requestId);
  });
};
