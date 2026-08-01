import type { ProviderCredential, Scan, User } from "@prisma/client";
import { normalizeFindings } from "./findings.js";

export function serializeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeCredential(credential: ProviderCredential) {
  return {
    id: credential.id,
    label: credential.label,
    provider: "gemini" as const,
    lastFour: credential.lastFour,
    status: credential.status,
    createdAt: credential.createdAt.toISOString(),
  };
}

export function serializeScan(scan: Scan) {
  return {
    id: scan.id,
    title: scan.title,
    language: scan.language,
    codePreview: scan.codePreview,
    provider: scan.provider,
    model: scan.model,
    summary: scan.summary,
    findings: normalizeFindings(scan.findings),
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
  };
}
