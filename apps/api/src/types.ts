export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SHARED_SCAN_RATE_LIMITER: RateLimit;
  BYOK_SCAN_RATE_LIMITER: RateLimit;
  RESOLVE_RATE_LIMITER: RateLimit;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  DEFAULT_MODEL_PROFILE_ID?: string;
  MODEL_PROFILES_JSON?: string;
  SHARED_SCAN_DAILY_CAP?: string;
  GROQ_API_KEY?: string;
}

export type StoredScanRow = {
  id: string;
  access_code_hash: string;
  management_token_hash: string;
  title: string;
  language: string;
  code_hash: string;
  code_preview: string;
  provider: "groq" | "openai-compatible" | "gemini";
  profile_id: string | null;
  model: string;
  summary: string;
  findings_json: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
};
