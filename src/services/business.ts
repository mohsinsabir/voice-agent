import type { PoolClient } from "pg";
import { getEnv } from "../config/env.js";
import { getPool, withBusinessContext } from "../db/pool.js";
import type { BusinessHours } from "./time.js";

export async function getBusinessId(): Promise<string> {
  const env = getEnv();
  if (env.DEFAULT_BUSINESS_ID) return env.DEFAULT_BUSINESS_ID;

  const result = await getPool().query<{ id: string }>(
    `SELECT id FROM businesses WHERE name = $1 LIMIT 1`,
    [env.DEFAULT_BUSINESS_NAME],
  );
  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error(`Business not found: ${env.DEFAULT_BUSINESS_NAME}`);
  }
  return id;
}

export type BusinessRow = {
  id: string;
  timezone: string;
  business_hours: BusinessHours;
};

export async function getBusinessMeta(
  client: PoolClient,
  businessId: string,
): Promise<BusinessRow> {
  const result = await client.query<BusinessRow>(
    `SELECT id, timezone, business_hours FROM businesses WHERE id = $1`,
    [businessId],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`Business not found: ${businessId}`);
  return row;
}

export async function withDefaultBusiness<T>(
  fn: (client: PoolClient, businessId: string) => Promise<T>,
): Promise<T> {
  const businessId = await getBusinessId();
  return withBusinessContext(businessId, (client) => fn(client, businessId));
}
