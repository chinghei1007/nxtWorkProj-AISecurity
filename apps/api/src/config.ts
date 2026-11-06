import { z } from "zod";
import type { Env } from "./types";

const modelProfileSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  provider: z.enum(["groq", "openai-compatible"]),
  model: z.string().min(1).max(160),
  baseUrl: z.string().url().optional(),
  apiKeyEnv: z.string().min(1).max(80),
});

export type ModelProfile = z.infer<typeof modelProfileSchema>;

export function modelProfiles(env: Env): ModelProfile[] {
  const parsed = env.MODEL_PROFILES_JSON
    ? z.array(modelProfileSchema).min(1).parse(JSON.parse(env.MODEL_PROFILES_JSON))
    : [modelProfileSchema.parse({
        id: "groq-default",
        label: env.SHARED_MODEL_NAME || "Groq · GPT OSS 120B",
        provider: "openai-compatible",
        model: env.SHARED_MODEL_ID || "openai/gpt-oss-120b",
        baseUrl: env.SHARED_MODEL_BASE_URL || "https://api.groq.com/openai/v1",
        apiKeyEnv: env.SHARED_MODEL_API_KEY || env.SHARED_MODEL_ID || env.SHARED_MODEL_NAME || env.SHARED_MODEL_BASE_URL
          ? "SHARED_MODEL_API_KEY"
          : "GROQ_API_KEY",
      })];
  if (new Set(parsed.map((profile) => profile.id)).size !== parsed.length) {
    throw new Error("MODEL_PROFILES_JSON contains duplicate IDs.");
  }
  return parsed;
}

export function defaultProfileId(env: Env) {
  const id = env.DEFAULT_MODEL_PROFILE_ID || "groq-default";
  if (!modelProfiles(env).some((profile) => profile.id === id)) {
    throw new Error("DEFAULT_MODEL_PROFILE_ID does not match a configured model profile.");
  }
  return id;
}

export function profileBaseUrl(profile: ModelProfile) {
  if (profile.baseUrl) return profile.baseUrl;
  return profile.provider === "groq"
    ? "https://api.groq.com/openai/v1"
    : "https://api.openai.com/v1";
}

export function sharedDailyCap(env: Env) {
  const parsed = Number(env.SHARED_SCAN_DAILY_CAP || 100);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 100;
}

export function profileSecret(env: Env, profile: ModelProfile) {
  const value = (env as unknown as Record<string, unknown>)[profile.apiKeyEnv];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
