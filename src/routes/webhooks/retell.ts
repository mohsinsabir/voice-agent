import type { FastifyPluginAsync } from "fastify";
import { getEnv } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { recordWebhookEvent } from "../../db/idempotency.js";
import { emitCallCompleted } from "../../services/automation.js";
import { withDefaultBusiness } from "../../services/business.js";
import { ensureCall } from "../../services/calls.js";

type RetellWebhookBody = {
  event?: string;
  call?: {
    call_id?: string;
    agent_id?: string;
    transcript_object?: Array<{
      role?: string;
      content?: string;
      words?: unknown[];
    }>;
    transcript?: string;
    disconnection_reason?: string;
    call_analysis?: {
      call_successful?: boolean;
      user_sentiment?: string;
      call_summary?: string;
    };
  };
  // Some Retell payloads nest under data
  data?: RetellWebhookBody["call"];
};

function extractCall(body: RetellWebhookBody) {
  return body.call ?? body.data;
}

export const retellWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/webhooks/retell", async (request, reply) => {
    const env = getEnv();
    const secret = request.headers["x-internal-tool-secret"];
    const signature = request.headers["x-retell-signature"];

    // Phase 2 bootstrap: accept shared tool secret until full Retell signature verify is wired
    // with RETELL_API_KEY (ENABLE_RETELL=true).
    const secretOk =
      typeof secret === "string" &&
      Boolean(env.RETELL_TOOL_SECRET) &&
      secret === env.RETELL_TOOL_SECRET;

    if (!secretOk) {
      if (env.ENABLE_RETELL && signature) {
        // Signature verification with retell-sdk lands when ENABLE_RETELL is fully configured.
        logger.warn("Retell signature present but verifier not yet enabled; rejecting");
      }
      return reply.status(401).send({ error: "unauthorized" });
    }

    const body = request.body as RetellWebhookBody;
    const eventType = body.event ?? "unknown";
    const call = extractCall(body);
    const providerCallId = call?.call_id;
    if (!providerCallId) {
      return reply.status(200).send({ status: "ignored", reason: "missing_call_id" });
    }

    const ledger = await recordWebhookEvent({
      source: "retell",
      externalEventId: `${providerCallId}:${eventType}`,
      eventType,
      rawPayload: body,
    });

    if (ledger.status === "ignored_duplicate") {
      return reply.status(200).send({ status: "ignored_duplicate" });
    }

    await withDefaultBusiness(async (client, businessId) => {
      const callId = await ensureCall(client, businessId, providerCallId);

      if (eventType === "call_started") {
        await client.query(
          `UPDATE calls SET status = 'in_progress', started_at = COALESCE(started_at, now()), metadata = metadata || $2::jsonb
           WHERE id = $1`,
          [callId, JSON.stringify({ agent_id: call?.agent_id ?? null })],
        );
      }

      if (eventType === "call_ended") {
        await client.query(
          `UPDATE calls SET status = 'completed', ended_at = now()
           WHERE id = $1`,
          [callId],
        );
        // Phase 3: enqueue call.completed (+ optional n8n POST when ENABLE_N8N=true)
        await emitCallCompleted(client, businessId, callId, providerCallId);
      }

      if (eventType === "call_analyzed") {
        const sentiment = call?.call_analysis?.user_sentiment?.toLowerCase();
        const label =
          sentiment === "positive" || sentiment === "negative" || sentiment === "neutral"
            ? sentiment
            : null;
        await client.query(
          `UPDATE calls SET
             sentiment_label = COALESCE($2, sentiment_label),
             metadata = metadata || $3::jsonb
           WHERE id = $1`,
          [
            callId,
            label,
            JSON.stringify({
              call_summary: call?.call_analysis?.call_summary ?? null,
              call_successful: call?.call_analysis?.call_successful ?? null,
            }),
          ],
        );

        const segments = call?.transcript_object ?? [];
        let seq = 0;
        for (const turn of segments) {
          seq += 1;
          const speaker = turn.role === "agent" ? "agent" : "caller";
          const content = (turn.content ?? "").slice(0, 8000);
          await client.query(
            `INSERT INTO transcript_segments (call_id, sequence, speaker, content_redacted, contains_pii, spoken_at)
             VALUES ($1, $2, $3, $4, false, now())
             ON CONFLICT (call_id, sequence) DO NOTHING`,
            [callId, seq, speaker, content],
          );
        }
      }

      await client.query(
        `UPDATE webhook_events SET status = 'processed', processed_at = now(), call_id = $2 WHERE id = $1`,
        [ledger.id, callId],
      );
    });

    logger.info({ eventType, providerCallId }, "Retell webhook processed");
    return reply.status(200).send({ status: "processed" });
  });
};
