import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

for (const candidate of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate, quiet: true });
    break;
  }
}

const modelProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.enum(["groq", "openai-compatible"]),
  model: z.string().min(1),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1),
});

export type ModelProfile = z.infer<typeof modelProfileSchema>;

const defaultProfiles: ModelProfile[] = [
  {
    id: "groq-default",
    label: "Groq · GPT OSS 120B",
    provider: "groq",
    model: "openai/gpt-oss-120b",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
  },
];

function parseProfiles(value: string | undefined): ModelProfile[] {
  if (!value) return defaultProfiles;
  const parsed = z.array(modelProfileSchema).min(1).parse(JSON.parse(value));
  const ids = new Set(parsed.map((profile) => profile.id));
  if (ids.size !== parsed.length) throw new Error("MODEL_PROFILES_JSON contains duplicate IDs.");
  return parsed;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/security_scanner?schema=public"),
  SESSION_COOKIE_NAME: z.string().default("secure_scan_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
  DEFAULT_MODEL_PROFILE_ID: z.string().default("groq-default"),
  MODEL_PROFILES_JSON: z.string().optional(),
});

const parsed = envSchema.parse(process.env);
const modelProfiles = parseProfiles(parsed.MODEL_PROFILES_JSON);

if (!modelProfiles.some((profile) => profile.id === parsed.DEFAULT_MODEL_PROFILE_ID)) {
  throw new Error("DEFAULT_MODEL_PROFILE_ID does not match a configured model profile.");
}

if (parsed.NODE_ENV === "production" && !parsed.CREDENTIAL_ENCRYPTION_KEY) {
  throw new Error("CREDENTIAL_ENCRYPTION_KEY is required in production.");
}

export const config = {
  ...parsed,
  modelProfiles,
  isProduction: parsed.NODE_ENV === "production",
};
