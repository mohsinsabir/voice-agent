import type { FastifyPluginAsync } from "fastify";
import { checkDatabaseConnectivity } from "../db/pool.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async (_request, reply) => {
    const db = await checkDatabaseConnectivity();
    if (!db.ok) {
      return reply.status(503).send({
        status: "unhealthy",
        database: "down",
        error: db.error,
      });
    }
    return reply.status(200).send({
      status: "healthy",
      database: "up",
    });
  });
};
