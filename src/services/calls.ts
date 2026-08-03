import type { PoolClient } from "pg";

export async function ensureCall(
  client: PoolClient,
  businessId: string,
  providerCallId: string,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM calls WHERE provider_call_id = $1`,
    [providerCallId],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO calls (business_id, provider_call_id, direction, status)
     VALUES ($1, $2, 'inbound', 'in_progress')
     ON CONFLICT (provider_call_id) DO UPDATE SET provider_call_id = EXCLUDED.provider_call_id
     RETURNING id`,
    [businessId, providerCallId],
  );
  return inserted.rows[0]!.id;
}

export async function logToolInvocation(
  client: PoolClient,
  input: {
    callId: string;
    toolName: string;
    args: unknown;
    output: unknown;
    status: "success" | "failed" | "timeout";
    latencyMs: number;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO tool_invocations (call_id, tool_name, input, output, status, latency_ms)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)`,
    [
      input.callId,
      input.toolName,
      JSON.stringify(input.args),
      JSON.stringify(input.output),
      input.status,
      input.latencyMs,
    ],
  );
}

export async function findSuccessfulToolResult(
  client: PoolClient,
  callId: string,
  toolName: string,
): Promise<Record<string, unknown> | null> {
  const result = await client.query<{ output: Record<string, unknown> }>(
    `SELECT output FROM tool_invocations
     WHERE call_id = $1 AND tool_name = $2 AND status = 'success'
     ORDER BY invoked_at DESC
     LIMIT 1`,
    [callId, toolName],
  );
  return result.rows[0]?.output ?? null;
}
