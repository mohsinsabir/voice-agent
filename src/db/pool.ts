import pg from "pg";
import { getEnv } from "../config/env.js";
import { logger } from "../config/logger.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const env = getEnv();
    const useSsl =
      env.DATABASE_URL.includes("supabase.co") || env.DATABASE_URL.includes("pooler.supabase.com");
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
    pool.on("error", (err) => {
      logger.error({ err }, "Unexpected Postgres pool error");
    });
  }
  return pool;
}

/** Sets tenant context for RLS on the given client. */
export async function withBusinessContext<T>(
  businessId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [businessId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDatabaseConnectivity(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await getPool().query("SELECT 1 AS ok");
    return { ok: result.rows[0]?.ok === 1 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error";
    return { ok: false, error: message };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
