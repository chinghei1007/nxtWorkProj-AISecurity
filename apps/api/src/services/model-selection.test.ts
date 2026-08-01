import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  preference: vi.fn(),
  user: vi.fn(),
  decrypt: vi.fn(() => "personal-key"),
}));

vi.mock("../config.js", () => ({
  config: {
    DEFAULT_MODEL_PROFILE_ID: "standard",
    modelProfiles: [
      { id: "standard", label: "Standard", provider: "groq", model: "standard-model", baseUrl: "https://example.com/v1", apiKeyEnv: "STANDARD_KEY", requiredAccessTier: "LIMITED" },
      { id: "premium", label: "Premium", provider: "groq", model: "premium-model", baseUrl: "https://example.com/v1", apiKeyEnv: "PREMIUM_KEY", requiredAccessTier: "FULL_DEMO" },
    ],
  },
}));
vi.mock("../db.js", () => ({ prisma: { modelPreference: { findUnique: mocks.preference }, user: { findUnique: mocks.user } } }));
vi.mock("../lib/crypto.js", () => ({ decryptSecret: mocks.decrypt }));

import { listSafeModels, resolveModelSelection } from "./model-selection.js";

describe("shared model access tiers", () => {
  beforeEach(() => {
    process.env.STANDARD_KEY = "standard-key";
    process.env.PREMIUM_KEY = "premium-key";
    mocks.preference.mockReset();
    mocks.user.mockReset();
  });

  it("marks premium shared profiles locked for limited users and falls back safely", async () => {
    mocks.user.mockResolvedValue({ accessTier: "LIMITED" });
    mocks.preference.mockResolvedValue({ source: "SERVER", profileId: "premium", credential: null });
    const models = await listSafeModels("user-1");
    expect(models.find((model) => model.id === "premium")).toMatchObject({ locked: true, requiredAccessTier: "FULL_DEMO", selected: false });
    expect(models.find((model) => model.id === "standard")?.selected).toBe(true);
    await expect(resolveModelSelection("user-1")).resolves.toMatchObject({ profileId: "standard", model: "standard-model" });
  });

  it("always permits a user-owned credential", async () => {
    mocks.user.mockResolvedValue({ accessTier: "LIMITED" });
    mocks.preference.mockResolvedValue({ source: "USER", model: "gemini-model", credential: { id: "credential-1", label: "Mine" } });
    await expect(resolveModelSelection("user-1")).resolves.toMatchObject({ source: "USER", credentialId: "credential-1", apiKey: "personal-key" });
  });
});
