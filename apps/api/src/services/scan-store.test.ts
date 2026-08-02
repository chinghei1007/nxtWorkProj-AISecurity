import { beforeEach, describe, expect, it } from "vitest";
import type { Env, StoredScanRow } from "../types";
import {
  cleanupExpired,
  consumeSharedQuota,
  deleteScan,
  insertScan,
  readScan,
  renameScan,
  resolveScan,
  scanRetentionMs,
} from "./scan-store";

function swapCase(value: string) {
  return [...value].map((character) => character === character.toUpperCase() ? character.toLowerCase() : character.toUpperCase()).join("");
}

class FakeStatement {
  private values: unknown[] = [];
  constructor(private readonly database: FakeDatabase, private readonly sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }

  async first<T>() {
    const sql = this.sql.replace(/\s+/g, " ").trim();
    let value: unknown = null;
    if (sql === "SELECT * FROM scans WHERE id = ?") {
      value = this.database.scans.get(String(this.values[0])) ?? null;
    } else if (sql.includes("WHERE access_code_hash = ?") && !sql.includes("id = ?")) {
      value = [...this.database.scans.values()].find((row) => row.access_code_hash === this.values[0]) ?? null;
    } else if (sql.includes("WHERE id = ? AND access_code_hash = ?")) {
      const row = this.database.scans.get(String(this.values[0]));
      value = row?.access_code_hash === this.values[1] ? row : null;
    } else if (sql.includes("WHERE id = ? AND management_token_hash = ?")) {
      const row = this.database.scans.get(String(this.values[0]));
      value = row?.management_token_hash === this.values[1] ? row : null;
    } else if (sql.startsWith("INSERT INTO daily_usage")) {
      const day = String(this.values[0]);
      const cap = Number(this.values[1]);
      const next = (this.database.usage.get(day) ?? 0) + 1;
      if (next <= cap) {
        this.database.usage.set(day, next);
        value = { shared_scan_count: next };
      }
    }
    return value as T | null;
  }

  async run() {
    const sql = this.sql.replace(/\s+/g, " ").trim();
    let changes = 0;
    if (sql.startsWith("INSERT INTO scans")) {
      const [
        id, accessCodeHash, managementTokenHash, title, language, codeHash, codePreview,
        provider, profileId, model, summary, findingsJson, createdAt, updatedAt, expiresAt,
      ] = this.values.map((value) => value === null ? null : String(value));
      if ([...this.database.scans.values()].some((row) => row.access_code_hash === accessCodeHash)) {
        throw new Error("UNIQUE constraint failed: scans.access_code_hash");
      }
      this.database.scans.set(id!, {
        id: id!, access_code_hash: accessCodeHash!, management_token_hash: managementTokenHash!,
        title: title!, language: language!, code_hash: codeHash!, code_preview: codePreview!,
        provider: provider as StoredScanRow["provider"], profile_id: profileId ?? null, model: model!,
        summary: summary!, findings_json: findingsJson!, created_at: createdAt!, updated_at: updatedAt!,
        expires_at: expiresAt!,
      });
      changes = 1;
    } else if (sql.startsWith("UPDATE scans SET title")) {
      const row = this.database.scans.get(String(this.values[2]));
      if (row) {
        row.title = String(this.values[0]);
        row.updated_at = String(this.values[1]);
        changes = 1;
      }
    } else if (sql === "DELETE FROM scans WHERE id = ?") {
      changes = this.database.scans.delete(String(this.values[0])) ? 1 : 0;
    } else if (sql.startsWith("DELETE FROM scans WHERE id IN")) {
      const cutoff = String(this.values[0]);
      const expired = [...this.database.scans.values()]
        .filter((row) => row.expires_at <= cutoff)
        .sort((a, b) => a.expires_at.localeCompare(b.expires_at))
        .slice(0, 500);
      for (const row of expired) this.database.scans.delete(row.id);
      changes = expired.length;
    } else if (sql.startsWith("DELETE FROM daily_usage")) {
      const cutoff = String(this.values[0]);
      for (const day of this.database.usage.keys()) if (day < cutoff) this.database.usage.delete(day);
    }
    return { meta: { changes } };
  }
}

class FakeDatabase {
  scans = new Map<string, StoredScanRow>();
  usage = new Map<string, number>();
  prepare(sql: string) { return new FakeStatement(this, sql); }
}

let database: FakeDatabase;
let env: Env;
const createdAt = new Date("2026-08-02T03:04:05.000Z");

beforeEach(() => {
  database = new FakeDatabase();
  env = { DB: database as unknown as D1Database } as Env;
});

async function createScan() {
  return insertScan(env, {
    title: "Capability test",
    language: "typescript",
    codeHash: "a".repeat(64),
    codePreview: "const secret = input;",
    provider: "groq",
    profileId: "groq-default",
    model: "test-model",
    summary: "One issue.",
    findings: [],
    now: createdAt,
  });
}

describe("D1 scan retention and capabilities", () => {
  it("stores only hashes and expires exactly 24 hours after creation", async () => {
    const created = await createScan();
    expect(new Date(created.row.expires_at).getTime() - createdAt.getTime()).toBe(scanRetentionMs);
    expect(created.row.access_code_hash).not.toBe(created.accessCode);
    expect(created.row.management_token_hash).not.toBe(created.managementToken);
    expect(created.row.access_code_hash).toHaveLength(64);
    expect(created.row.management_token_hash).toHaveLength(64);
    expect(created.row).not.toHaveProperty("source");
  });

  it("keeps view and management capabilities separate and case-sensitive", async () => {
    const created = await createScan();
    await expect(resolveScan(env, created.accessCode, createdAt)).resolves.toMatchObject({ id: created.row.id });
    await expect(readScan(env, created.row.id, created.accessCode, createdAt)).resolves.toMatchObject({ id: created.row.id });
    await expect(readScan(env, created.row.id, swapCase(created.accessCode), createdAt)).rejects.toMatchObject({ code: "SCAN_NOT_FOUND" });
    await expect(readScan(env, created.row.id, created.managementToken, createdAt)).rejects.toMatchObject({ code: "SCAN_NOT_FOUND" });
    await expect(renameScan(env, created.row.id, created.accessCode, "Nope", createdAt)).rejects.toMatchObject({ code: "SCAN_NOT_FOUND" });
    await expect(renameScan(env, created.row.id, created.managementToken, "Renamed", createdAt)).resolves.toMatchObject({ title: "Renamed" });
  });

  it("returns SCAN_EXPIRED at the exact boundary and cleanup removes expired rows", async () => {
    const created = await createScan();
    const boundary = new Date(created.row.expires_at);
    await expect(readScan(env, created.row.id, created.accessCode, boundary)).rejects.toMatchObject({
      statusCode: 410,
      code: "SCAN_EXPIRED",
    });
    expect(await cleanupExpired(env, boundary)).toBe(1);
    await expect(resolveScan(env, created.accessCode, boundary)).rejects.toMatchObject({ code: "SCAN_NOT_FOUND" });
  });

  it("enforces the atomic shared daily cap", async () => {
    expect(await consumeSharedQuota(env, 2, createdAt)).toBe(1);
    expect(await consumeSharedQuota(env, 2, createdAt)).toBe(2);
    await expect(consumeSharedQuota(env, 2, createdAt)).rejects.toMatchObject({
      statusCode: 429,
      code: "SHARED_DAILY_CAP_REACHED",
    });
  });

  it("requires the management token to delete", async () => {
    const created = await createScan();
    await expect(deleteScan(env, created.row.id, created.accessCode, createdAt)).rejects.toMatchObject({ code: "SCAN_NOT_FOUND" });
    await deleteScan(env, created.row.id, created.managementToken, createdAt);
    expect(database.scans.size).toBe(0);
  });
});
