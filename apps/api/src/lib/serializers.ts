import type { ProviderCredential, Scan, User } from "@prisma/client";
import { normalizeFindings } from "./findings.js";

export function serializeUser(user: User) {
  const effectiveStatus = user.status === "DISABLED"
    ? "DISABLED" as const
    : user.expiresAt && user.expiresAt <= new Date()
      ? "EXPIRED" as const
      : "ACTIVE" as const;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    accessTier: user.accessTier,
    expiresAt: user.expiresAt?.toISOString() ?? null,
    effectiveStatus,
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
