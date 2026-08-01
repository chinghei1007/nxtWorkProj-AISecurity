import Papa from "papaparse";
import type { AccessTier, Role } from "@secure-scan/contracts";

export type EditableBatchRow = {
  clientRowId: string;
  username: string;
  temporaryPassword: string;
  role: string;
  accessTier: string;
  expiresAt: string;
};

const headers = ["username", "temporaryPassword", "role", "accessTier", "expiresAt"];

export function parseBatchCsv(value: string): EditableBatchRow[] {
  const parsed = Papa.parse<Record<string, string>>(value, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  return parsed.data.map((row, index) => ({
    clientRowId: `row-${index + 1}`,
    username: (row.username ?? "").trim(),
    temporaryPassword: row.temporaryPassword ?? "",
    role: normalizeRole(row.role),
    accessTier: normalizeTier(row.accessTier),
    expiresAt: (row.expiresAt ?? "").trim(),
  }));
}

function normalizeRole(value: string | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function normalizeTier(value: string | undefined) {
  return value?.trim().toUpperCase().replace(/[ -]+/g, "_") ?? "";
}

export function batchTemplateCsv() {
  return Papa.unparse({
    fields: headers,
    data: [["demo-user", "", "USER", "LIMITED", "2026-12-31T23:59:00Z"]],
  });
}

export function credentialsCsv(rows: Array<{
  username: string;
  temporaryPassword: string;
  role: Role;
  accessTier: AccessTier;
  expiresAt: string | null;
}>) {
  return Papa.unparse({ fields: headers, data: rows.map((row) => [
    row.username,
    row.temporaryPassword,
    row.role,
    row.accessTier,
    row.expiresAt ?? "",
  ]) });
}

export function downloadText(filename: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function toLocalDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function toIsoOrOriginal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
