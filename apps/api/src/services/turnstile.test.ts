import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types";
import { validateTurnstile } from "./turnstile";

const env = {
  TURNSTILE_SECRET_KEY: "test-secret",
  TURNSTILE_EXPECTED_HOSTNAME: "localhost",
} as Env;

afterEach(() => vi.unstubAllGlobals());

describe("Turnstile validation", () => {
  it("posts the token to Siteverify and validates hostname and action", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      hostname: "localhost",
      action: "scan",
    }), { status: 200 }));
    vi.stubGlobal("fetch", request);

    await expect(validateTurnstile(env, "verified-token", "203.0.113.7")).resolves.toBeUndefined();
    const body = request.mock.calls[0]![1]!.body as URLSearchParams;
    expect(request.mock.calls[0]![0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(body.get("secret")).toBe("test-secret");
    expect(body.get("response")).toBe("verified-token");
    expect(body.get("remoteip")).toBe("203.0.113.7");
  });

  it.each([
    [{ success: false }, "TURNSTILE_INVALID"],
    [{ success: true, hostname: "attacker.example", action: "scan" }, "TURNSTILE_INVALID"],
    [{ success: true, hostname: "localhost", action: "login" }, "TURNSTILE_INVALID"],
  ])("rejects invalid Siteverify results", async (result, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { status: 200 })));
    await expect(validateTurnstile(env, "bad-token")).rejects.toMatchObject({ code });
  });

  it("fails closed when the secret is not configured", async () => {
    await expect(validateTurnstile({} as Env, "token")).rejects.toMatchObject({
      statusCode: 503,
      code: "TURNSTILE_NOT_CONFIGURED",
    });
  });
});
