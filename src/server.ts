import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { loadEnv } from "./config/env.js";
import { logger } from "./config/logger.js";
import { closePool } from "./db/pool.js";
import { errorHandlerPlugin } from "./middleware/error-handler.js";
import { requestIdPlugin } from "./middleware/request-id.js";
import { healthRoutes } from "./routes/health.js";
import { toolRoutes } from "./routes/tools.js";
import { webCallRoutes } from "./routes/web-call.js";
import { retellWebhookRoutes } from "./routes/webhooks/retell.js";

export async function buildApp() {
  // Fail closed on bad config before binding the port.
  loadEnv();

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
  });

  await app.register(cors, {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "OPTIONS"],
  });
  await app.register(sensible);
  await app.register(requestIdPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(healthRoutes);
  await app.register(webCallRoutes);
  await app.register(toolRoutes);
  await app.register(retellWebhookRoutes);

  return app;
}

async function main() {
  const env = loadEnv();
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    await app.close();
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "Server listening");
}

const isDirectRun =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"));

if (isDirectRun) {
  main().catch((err) => {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  });
}
