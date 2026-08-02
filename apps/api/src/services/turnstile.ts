import { AppError } from "../lib/errors";
import type { Env } from "../types";

export async function validateTurnstile(env: Env, token: string, remoteIp?: string) {
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new AppError(503, "TURNSTILE_NOT_CONFIGURED", "Human verification is unavailable.");
  }
  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  if (remoteIp) body.set("remoteip", remoteIp);
  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AppError(503, "TURNSTILE_UNAVAILABLE", "Human verification is temporarily unavailable.");
  }
  const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
  if (!response.ok || !result.success) {
    throw new AppError(400, "TURNSTILE_INVALID", "Human verification failed. Please try again.");
  }
  if (env.TURNSTILE_EXPECTED_HOSTNAME && result.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME) {
    throw new AppError(400, "TURNSTILE_INVALID", "Human verification failed. Please try again.");
  }
  if (result.action && result.action !== "scan") {
    throw new AppError(400, "TURNSTILE_INVALID", "Human verification failed. Please try again.");
  }
}
