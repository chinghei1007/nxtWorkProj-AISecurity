import type { StoredFinding } from "@secure-scan/contracts";
import { createAccessCode, createManagementToken, sha256 } from "../lib/capabilities";
import { AppError } from "../lib/errors";
import { normalizeFindings } from "../lib/findings";
import type { Env, StoredScanRow } from "../types";

const RETENTION_MS = 24 * 60 * 60 * 1_000;

export function serializeScan(row: StoredScanRow) {
  return {
    id: row.id,
    title: row.title,
    language: row.language,
    codePreview: row.code_preview,
    provider: row.provider,
    model: row.model,
    summary: row.summary,
    findings: normalizeFindings(JSON.parse(row.findings_json) as unknown),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

function assertUnexpired(row: StoredScanRow, now = new Date()) {
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    throw new AppError(410, "SCAN_EXPIRED", "This scan has expired.");
  }
  return row;
}

export async function insertScan(env: Env, input: {
  title: string;
  language: string;
  codeHash: string;
  codePreview: string;
  provider: StoredScanRow["provider"];
  profileId: string | null;
  model: string;
  summary: string;
  findings: StoredFinding[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + RETENTION_MS).toISOString();
  const id = crypto.randomUUID();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const accessCode = createAccessCode();
    const managementToken = createManagementToken();
    try {
      await env.DB.prepare(`
        INSERT INTO scans (
          id, access_code_hash, management_token_hash, title, language, code_hash,
          code_preview, provider, profile_id, model, summary, findings_json,
          created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        await sha256(accessCode),
        await sha256(managementToken),
        input.title,
        input.language,
        input.codeHash,
        input.codePreview,
        input.provider,
        input.profileId,
        input.model,
        input.summary,
        JSON.stringify(input.findings),
        createdAt,
        createdAt,
        expiresAt,
      ).run();
      const row = await findScanById(env, id);
      return { row, accessCode, managementToken };
    } catch (error) {
      if (attempt === 4 || !String(error).toLowerCase().includes("unique")) throw error;
    }
  }
  throw new AppError(500, "CAPABILITY_GENERATION_FAILED", "The scan capability could not be created.");
}

export async function findScanById(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT * FROM scans WHERE id = ?").bind(id).first<StoredScanRow>();
  if (!row) throw new AppError(404, "SCAN_NOT_FOUND", "Scan not found.");
  return row;
}

export async function resolveScan(env: Env, accessCode: string, now = new Date()) {
  const row = await env.DB.prepare("SELECT * FROM scans WHERE access_code_hash = ?")
    .bind(await sha256(accessCode))
    .first<StoredScanRow>();
  if (!row) throw new AppError(404, "SCAN_NOT_FOUND", "Scan not found.");
  return assertUnexpired(row, now);
}

export async function readScan(env: Env, id: string, accessCode: string, now = new Date()) {
  const row = await env.DB.prepare("SELECT * FROM scans WHERE id = ? AND access_code_hash = ?")
    .bind(id, await sha256(accessCode))
    .first<StoredScanRow>();
  if (!row) throw new AppError(404, "SCAN_NOT_FOUND", "Scan not found.");
  return assertUnexpired(row, now);
}

async function managedScan(env: Env, id: string, token: string, now = new Date()) {
  const row = await env.DB.prepare("SELECT * FROM scans WHERE id = ? AND management_token_hash = ?")
    .bind(id, await sha256(token))
    .first<StoredScanRow>();
  if (!row) throw new AppError(404, "SCAN_NOT_FOUND", "Scan not found.");
  return assertUnexpired(row, now);
}

export async function renameScan(env: Env, id: string, token: string, title: string, now = new Date()) {
  await managedScan(env, id, token, now);
  const updatedAt = now.toISOString();
  await env.DB.prepare("UPDATE scans SET title = ?, updated_at = ? WHERE id = ?")
    .bind(title, updatedAt, id)
    .run();
  return assertUnexpired(await findScanById(env, id), now);
}

export async function deleteScan(env: Env, id: string, token: string, now = new Date()) {
  await managedScan(env, id, token, now);
  await env.DB.prepare("DELETE FROM scans WHERE id = ?").bind(id).run();
}

export async function consumeSharedQuota(env: Env, cap: number, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const row = await env.DB.prepare(`
    INSERT INTO daily_usage (day, shared_scan_count) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET shared_scan_count = shared_scan_count + 1
      WHERE shared_scan_count < ?
    RETURNING shared_scan_count
  `).bind(day, cap).first<{ shared_scan_count: number }>();
  if (!row) throw new AppError(429, "SHARED_DAILY_CAP_REACHED", "The shared model quota is exhausted for today.");
  return row.shared_scan_count;
}

export async function cleanupExpired(env: Env, now = new Date(), batches = 10) {
  let deleted = 0;
  for (let index = 0; index < batches; index += 1) {
    const result = await env.DB.prepare(`
      DELETE FROM scans WHERE id IN (
        SELECT id FROM scans WHERE expires_at <= ? ORDER BY expires_at LIMIT 500
      )
    `).bind(now.toISOString()).run();
    const count = result.meta.changes ?? 0;
    deleted += count;
    if (count < 500) break;
  }
  const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  await env.DB.prepare("DELETE FROM daily_usage WHERE day < ?").bind(cutoff).run();
  return deleted;
}

export const scanRetentionMs = RETENTION_MS;
