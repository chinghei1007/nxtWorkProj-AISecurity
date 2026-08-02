import { scanExportSchema, type Scan, type ScanExport } from "@secure-scan/contracts";
import { openDB, type DBSchema } from "idb";

const DB_NAME = "sentinel-browser-archive";
const INDEX_KEY = "sentinel.history.index.v1";
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type RemoteReference = {
  id: string;
  title: string;
  createdAt: string;
  expiresAt: string;
  provider: string;
  model: string;
  accessCode: string;
  managementToken?: string;
  shareUrl: string;
};

export type LocalReportRecord = {
  localId: string;
  importedAt: string;
  report: ScanExport;
};

type PublicHistoryItem = {
  id: string;
  kind: "remote" | "local";
  title: string;
  createdAt: string;
  expiresAt?: string;
};

interface ArchiveDatabase extends DBSchema {
  remote: { key: string; value: RemoteReference };
  reports: { key: string; value: LocalReportRecord };
}

function database() {
  return openDB<ArchiveDatabase>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore("remote", { keyPath: "id" });
      db.createObjectStore("reports", { keyPath: "localId" });
    },
  });
}

function updatePublicIndex(items: PublicHistoryItem[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(items));
  } catch {
    // IndexedDB remains the source of truth when localStorage is unavailable.
  }
}

async function refreshPublicIndex() {
  const db = await database();
  const [remote, local] = await Promise.all([db.getAll("remote"), db.getAll("reports")]);
  updatePublicIndex([
    ...remote.map((item) => ({
      id: item.id,
      kind: "remote" as const,
      title: item.title,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt,
    })),
    ...local.map((item) => ({
      id: item.localId,
      kind: "local" as const,
      title: item.report.scan.title,
      createdAt: item.report.scan.createdAt,
    })),
  ]);
}

export function remoteReference(scan: Scan, access: {
  code: string;
  managementToken?: string;
  shareUrl?: string;
}): RemoteReference {
  return {
    id: scan.id,
    title: scan.title,
    createdAt: scan.createdAt,
    expiresAt: scan.expiresAt,
    provider: scan.provider,
    model: scan.model,
    accessCode: access.code,
    ...(access.managementToken ? { managementToken: access.managementToken } : {}),
    shareUrl: access.shareUrl ?? `${window.location.origin}/open#${access.code}`,
  };
}

export async function saveRemoteReference(reference: RemoteReference) {
  const db = await database();
  await db.put("remote", reference);
  await refreshPublicIndex();
}

export async function listRemoteReferences() {
  const db = await database();
  const items = await db.getAll("remote");
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRemoteReference(id: string) {
  return (await database()).get("remote", id);
}

export async function removeRemoteReference(id: string) {
  const db = await database();
  await db.delete("remote", id);
  await refreshPublicIndex();
}

function canonicalReport(report: ScanExport) {
  return JSON.stringify(scanExportSchema.parse(report));
}

export async function reportFingerprint(report: ScanExport) {
  const bytes = new TextEncoder().encode(canonicalReport(report));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function saveLocalReport(report: ScanExport) {
  const validated = scanExportSchema.parse(report);
  const localId = await reportFingerprint(validated);
  const db = await database();
  const existing = await db.get("reports", localId);
  if (existing) return { record: existing, created: false };
  const record: LocalReportRecord = {
    localId,
    importedAt: new Date().toISOString(),
    report: validated,
  };
  await db.put("reports", record);
  await refreshPublicIndex();
  return { record, created: true };
}

export async function listLocalReports() {
  const db = await database();
  const items = await db.getAll("reports");
  return items.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getLocalReport(localId: string) {
  return (await database()).get("reports", localId);
}

export async function removeLocalReport(localId: string) {
  const db = await database();
  await db.delete("reports", localId);
  await refreshPublicIndex();
}

export async function parseReportFile(file: File) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("JSON reports must be 5 MB or smaller.");
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  const parsed = scanExportSchema.safeParse(value);
  if (!parsed.success) throw new Error("The file is not a compatible Sentinel report (schema 1.0).");
  return parsed.data;
}

export async function clearArchiveForTests() {
  const db = await database();
  await Promise.all([db.clear("remote"), db.clear("reports")]);
  localStorage.removeItem(INDEX_KEY);
}
