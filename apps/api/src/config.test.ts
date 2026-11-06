import { describe, expect, it } from "vitest";
import { modelProfiles, profileBaseUrl, profileSecret } from "./config";
import type { Env } from "./types";

const env = (values: Partial<Env> = {}) => values as Env;

describe("shared model configuration", () => {
  it("uses the legacy Groq configuration when no new values are set", () => {
    const settings = env({ GROQ_API_KEY: "legacy-secret" });
    const profile = modelProfiles(settings)[0]!;
    expect(profile.model).toBe("openai/gpt-oss-120b");
    expect(profileSecret(settings, profile)).toBe("legacy-secret");
  });

  it("uses the configured provider, name, model and secret", () => {
    const settings = env({ SHARED_MODEL_ID: "my-model", SHARED_MODEL_NAME: "My model", SHARED_MODEL_BASE_URL: "https://provider.example/v1", SHARED_MODEL_API_KEY: "private-secret", GROQ_API_KEY: "old-secret" });
    const profile = modelProfiles(settings)[0]!;
    expect(profile.model).toBe("my-model");
    expect(profile.label).toBe("My model");
    expect(profileBaseUrl(profile)).toBe("https://provider.example/v1");
    expect(profileSecret(settings, profile)).toBe("private-secret");
  });

  it("keeps explicit multi-profile configuration authoritative", () => {
    const settings = env({ SHARED_MODEL_ID: "ignored", MODEL_PROFILES_JSON: JSON.stringify([{ id: "custom", label: "Custom", model: "configured", provider: "openai-compatible", apiKeyEnv: "CUSTOM_KEY" }]) });
    expect(modelProfiles(settings)[0]?.model).toBe("configured");
  });

  it("does not send a legacy key to a newly configured provider", () => {
    const settings = env({ SHARED_MODEL_BASE_URL: "https://other.example/v1", GROQ_API_KEY: "old-secret" });
    expect(profileSecret(settings, modelProfiles(settings)[0]!)).toBeUndefined();
  });
});
