import {
  createScanInputSchema,
  resolveScanInputSchema,
  updateScanInputSchema,
  validateGeminiKeyInputSchema,
} from "@secure-scan/contracts";
import { Hono } from "hono";
import { defaultProfileId, modelProfiles, profileBaseUrl, profileSecret, sharedDailyCap } from "./config";
import { sha256 } from "./lib/capabilities";
import { detectLanguage, looksLikeCode } from "./lib/code-gate";
import { AppError, errorPayload } from "./lib/errors";
import { enrichFindingsWithEvidence } from "./lib/findings";
import { buildScanExport, reportFilename } from "./lib/report-export";
import { auditWithGemini, auditWithOpenAICompatible, listGeminiModels } from "./services/providers";
import {
  consumeSharedQuota,
  deleteScan,
  insertScan,
  readScan,
  renameScan,
  resolveScan,
  serializeScan,
} from "./services/scan-store";
import { validateTurnstile } from "./services/turnstile";
import type { Env } from "./types";

type Variables = { requestId: string };
export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("/api/*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cache-Control", "no-store");
  const method = c.req.method;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(c.req.url).origin) {
      throw new AppError(403, "ORIGIN_DENIED", "Cross-origin request denied.");
    }
  }
  await next();
});

async function requestJson(c: { req: { json(): Promise<unknown> } }) {
  try {
    return await c.req.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
}

app.onError((error, c) => {
  const payload = errorPayload(error);
  return c.json(payload.body, payload.status as 400);
});

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } }, 404));

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.get("/api/models", (c) => {
  const models = modelProfiles(c.env).map((profile) => ({
    id: profile.id,
    label: profile.label,
    provider: profile.provider,
    source: "SERVER" as const,
    model: profile.model,
    available: Boolean(profileSecret(c.env, profile)),
  }));
  return c.json({ models, defaultProfileId: defaultProfileId(c.env) });
});

app.post("/api/models/gemini", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "local";
  const limited = await c.env.BYOK_SCAN_RATE_LIMITER.limit({ key: `gemini-models:${ip}` });
  if (!limited.success) throw new AppError(429, "RATE_LIMITED", "Too many model requests. Try again shortly.");
  const input = validateGeminiKeyInputSchema.parse(await requestJson(c));
  return c.json({ models: await listGeminiModels(input.apiKey) });
});

app.post("/api/scans", async (c) => {
  const input = createScanInputSchema.parse(await requestJson(c));
  if (!looksLikeCode(input.source)) throw new AppError(422, "NOT_CODE", "Does not seem like code.");

  const ip = c.req.header("cf-connecting-ip") || "local";
  const limiter = input.selection.source === "SERVER"
    ? c.env.SHARED_SCAN_RATE_LIMITER
    : c.env.BYOK_SCAN_RATE_LIMITER;
  const limited = await limiter.limit({ key: `scan:${ip}` });
  if (!limited.success) throw new AppError(429, "RATE_LIMITED", "Too many scans. Try again shortly.");
  await validateTurnstile(c.env, input.turnstileToken, ip === "local" ? undefined : ip);

  let provider: "groq" | "openai-compatible" | "gemini";
  let profileId: string | null;
  let model: string;
  let result;
  if (input.selection.source === "SERVER") {
    const requestedProfileId = input.selection.profileId;
    const profile = modelProfiles(c.env).find((candidate) => candidate.id === requestedProfileId);
    if (!profile) throw new AppError(400, "MODEL_NOT_FOUND", "The selected model is unavailable.");
    const apiKey = profileSecret(c.env, profile);
    if (!apiKey) throw new AppError(503, "MODEL_UNAVAILABLE", "The selected model is not configured.");
    await consumeSharedQuota(c.env, sharedDailyCap(c.env));
    provider = profile.provider;
    profileId = profile.id;
    model = profile.model;
    result = await auditWithOpenAICompatible({
      apiKey,
      baseUrl: profileBaseUrl(profile),
      model,
      source: input.source,
    });
  } else {
    provider = "gemini";
    profileId = null;
    model = input.selection.model;
    result = await auditWithGemini({ apiKey: input.selection.apiKey, model, source: input.source });
  }

  const language = detectLanguage(input.source);
  const stored = await insertScan(c.env, {
    title: input.title || `${language} security scan`,
    language,
    codeHash: await sha256(input.source),
    codePreview: input.source.trim().replace(/\s+/g, " ").slice(0, 160),
    provider,
    profileId,
    model,
    summary: result.summary,
    findings: enrichFindingsWithEvidence(result.findings, input.source),
  });
  const scan = serializeScan(stored.row);
  return c.json({
    scan,
    access: {
      code: stored.accessCode,
      managementToken: stored.managementToken,
      expiresAt: scan.expiresAt,
      shareUrl: `${new URL(c.req.url).origin}/open#${stored.accessCode}`,
    },
  }, 201);
});

app.post("/api/scans/resolve", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "local";
  const limited = await c.env.RESOLVE_RATE_LIMITER.limit({ key: `resolve:${ip}` });
  if (!limited.success) throw new AppError(429, "RATE_LIMITED", "Too many access attempts. Try again shortly.");
  const input = resolveScanInputSchema.parse(await requestJson(c));
  return c.json({ scan: serializeScan(await resolveScan(c.env, input.accessCode)) });
});

app.get("/api/scans/:id/export", async (c) => {
  const accessCode = c.req.header("x-scan-access-code");
  if (!accessCode) throw new AppError(401, "ACCESS_CODE_REQUIRED", "An access code is required.");
  const row = await readScan(c.env, c.req.param("id"), accessCode);
  if (c.req.query("download") === "1") {
    c.header("Content-Disposition", `attachment; filename="${reportFilename(row.title, row.id)}"`);
  }
  return c.json(buildScanExport(row));
});

app.get("/api/scans/:id", async (c) => {
  const accessCode = c.req.header("x-scan-access-code");
  if (!accessCode) throw new AppError(401, "ACCESS_CODE_REQUIRED", "An access code is required.");
  return c.json({ scan: serializeScan(await readScan(c.env, c.req.param("id"), accessCode)) });
});

app.patch("/api/scans/:id", async (c) => {
  const managementToken = c.req.header("x-scan-management-token");
  if (!managementToken) throw new AppError(401, "MANAGEMENT_TOKEN_REQUIRED", "A management token is required.");
  const input = updateScanInputSchema.parse(await requestJson(c));
  return c.json({ scan: serializeScan(await renameScan(c.env, c.req.param("id"), managementToken, input.title)) });
});

app.delete("/api/scans/:id", async (c) => {
  const managementToken = c.req.header("x-scan-management-token");
  if (!managementToken) throw new AppError(401, "MANAGEMENT_TOKEN_REQUIRED", "A management token is required.");
  await deleteScan(c.env, c.req.param("id"), managementToken);
  return c.body(null, 204);
});
