import { describe, expect, it } from "vitest";
import { auditWithOpenAICompatible } from "./providers";

type LiveProfile = {
  id: string;
  model: string;
  baseUrl?: string;
  apiKeyEnv: string;
};

const configuredProfiles = process.env.MODEL_PROFILES_JSON
  ? JSON.parse(process.env.MODEL_PROFILES_JSON) as LiveProfile[]
  : [];
const selectedProfile = configuredProfiles.find((profile) => profile.id === process.env.DEFAULT_MODEL_PROFILE_ID)
  ?? configuredProfiles[0]
  ?? {
    id: "groq-default",
    model: "openai/gpt-oss-120b",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
  };
const providerKey = process.env[selectedProfile.apiKeyEnv];
const enabled = process.env.LIVE_PROVIDER_TEST === "1" && Boolean(providerKey);

describe.skipIf(!enabled)("live OpenAI-compatible provider", () => {
  it("returns a schema-valid security report", async () => {
    const result = await auditWithOpenAICompatible({
      apiKey: providerKey!,
      baseUrl: selectedProfile.baseUrl ?? "https://api.groq.com/openai/v1",
      model: selectedProfile.model,
      source: "export function findUser(db, id) { return db.query(`SELECT * FROM users WHERE id = ${id}`); }",
    });

    expect(result.summary.length).toBeGreaterThan(0);
    expect(Array.isArray(result.findings)).toBe(true);
  }, 90_000);
});
