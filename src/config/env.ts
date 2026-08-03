import dotenv from "dotenv";

// Always prefer values from .env over inherited shell env (common Windows gotcha).
dotenv.config({ override: true });

import { z } from "zod";

const boolFromEnv = z.preprocess((v) => {
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "true" || t === "1";
  }
  return v === true || v === 1;
}, z.boolean());

const coreSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DEFAULT_BUSINESS_NAME: z.string().min(1).default("Bright Smile Dental"),
  DEFAULT_BUSINESS_TIMEZONE: z.string().min(1).default("America/New_York"),
  DEFAULT_BUSINESS_ID: z.string().uuid().optional(),
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  /** Shared secret for Retell custom-function tool calls (Phase 2). */
  RETELL_TOOL_SECRET: z.string().min(1).optional(),
  HANDOFF_TRANSFER_NUMBER: z.string().optional(),
  ENABLE_RETELL: boolFromEnv.default(false),
  ENABLE_CALENDAR: boolFromEnv.default(false),
  ENABLE_MESSAGING: boolFromEnv.default(false),
  ENABLE_N8N: boolFromEnv.default(false),
  ENABLE_HUBSPOT: boolFromEnv.default(false),
});

const retellSchema = z.object({
  RETELL_API_KEY: z.string().min(1),
  RETELL_AGENT_ID: z.string().min(1),
  RETELL_WEBHOOK_SECRET: z.string().min(1).optional(),
});

const calendarSchema = z.object({
  GOOGLE_CALENDAR_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().min(1),
});

const messagingSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_SMS_FROM_NUMBER: z.string().min(1),
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_FROM_EMAIL: z.string().email(),
});

const n8nSchema = z.object({
  N8N_WEBHOOK_URL: z.string().url(),
  N8N_WEBHOOK_SECRET: z.string().min(1),
});

const hubspotSchema = z.object({
  HUBSPOT_ACCESS_TOKEN: z.string().min(1),
});

export type Env = z.infer<typeof coreSchema> &
  Partial<z.infer<typeof retellSchema>> &
  Partial<z.infer<typeof calendarSchema>> &
  Partial<z.infer<typeof messagingSchema>> &
  Partial<z.infer<typeof n8nSchema>> &
  Partial<z.infer<typeof hubspotSchema>>;

function requireWhen(
  enabled: boolean,
  label: string,
  schema: z.ZodType,
  env: NodeJS.ProcessEnv,
): Record<string, unknown> {
  if (!enabled) return {};
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid ${label} configuration: ${details}`);
  }
  return parsed.data as Record<string, unknown>;
}

export function loadEnv(processEnv: NodeJS.ProcessEnv = process.env): Env {
  const core = coreSchema.safeParse(processEnv);
  if (!core.success) {
    const details = core.error.issues
      .map((i) => `${i.path.join(".") || "env"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const data = core.data;
  return {
    ...data,
    ...requireWhen(data.ENABLE_RETELL, "Retell", retellSchema, processEnv),
    ...requireWhen(data.ENABLE_CALENDAR, "Google Calendar", calendarSchema, processEnv),
    ...requireWhen(data.ENABLE_MESSAGING, "Messaging", messagingSchema, processEnv),
    ...requireWhen(data.ENABLE_N8N, "n8n", n8nSchema, processEnv),
    ...requireWhen(data.ENABLE_HUBSPOT, "HubSpot", hubspotSchema, processEnv),
  } as Env;
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    cached = loadEnv();
  }
  return cached;
}

/** Test helper — clears memoized env. */
export function resetEnvCache(): void {
  cached = null;
}
