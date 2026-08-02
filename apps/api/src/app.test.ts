import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";
import type { Env } from "./types";

afterEach(() => vi.unstubAllGlobals());

describe("anonymous Worker API boundary", () => {
  it("rejects prose before rate limiting, Turnstile, or a provider call", async () => {
    const providerFetch = vi.fn();
    vi.stubGlobal("fetch", providerFetch);
    const response = await app.request("http://scanner.test/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://scanner.test" },
      body: JSON.stringify({
        source: "This is ordinary prose explaining a security review without any source syntax.",
        turnstileToken: "turnstile-token",
        selection: { source: "SERVER", profileId: "groq-default" },
      }),
    }, {} as Env);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_CODE", message: "Does not seem like code." },
    });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("rejects cross-origin writes", async () => {
    const response = await app.request("http://scanner.test/api/scans/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ accessCode: "AbCd2345EfGh" }),
    }, {} as Env);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "ORIGIN_DENIED" } });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("returns a sanitized validation error for malformed JSON", async () => {
    const response = await app.request("http://scanner.test/api/scans/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://scanner.test" },
      body: "{broken",
    }, {
      RESOLVE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    } as unknown as Env);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INVALID_JSON", message: "The request body must be valid JSON." },
    });
  });

  it("returns only safe model metadata and the configured default profile", async () => {
    const env = {
      DEFAULT_MODEL_PROFILE_ID: "compatible",
      MODEL_PROFILES_JSON: JSON.stringify([{
        id: "compatible",
        label: "Compatible model",
        provider: "openai-compatible",
        model: "secure-model",
        apiKeyEnv: "PRIVATE_MODEL_KEY",
      }]),
      PRIVATE_MODEL_KEY: "never-return-this",
    } as unknown as Env;
    const response = await app.request("http://scanner.test/api/models", undefined, env);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      defaultProfileId: "compatible",
      models: [{
        id: "compatible",
        provider: "openai-compatible",
        model: "secure-model",
        available: true,
      }],
    });
    expect(JSON.stringify(body)).not.toContain("never-return-this");
    expect(JSON.stringify(body)).not.toContain("PRIVATE_MODEL_KEY");
  });

  it("requires distinct capability headers for read and management routes", async () => {
    const read = await app.request("http://scanner.test/api/scans/scan-id", undefined, {} as Env);
    expect(read.status).toBe(401);
    await expect(read.json()).resolves.toMatchObject({ error: { code: "ACCESS_CODE_REQUIRED" } });

    const remove = await app.request("http://scanner.test/api/scans/scan-id", { method: "DELETE" }, {} as Env);
    expect(remove.status).toBe(401);
    await expect(remove.json()).resolves.toMatchObject({ error: { code: "MANAGEMENT_TOKEN_REQUIRED" } });
  });
});
