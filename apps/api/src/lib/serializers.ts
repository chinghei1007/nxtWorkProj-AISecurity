import type { ProviderCredential, Scan, User } from "@prisma/client";
import { findingSchema, type Finding } from "@secure-scan/contracts";

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
  const findings = Array.isArray(scan.findings)
    ? scan.findings.map((finding) => findingSchema.parse(finding))
    : ([] as Finding[]);

  return {
    id: scan.id,
    title: scan.title,
    language: scan.language,
    codePreview: scan.codePreview,
    provider: scan.provider,
    model: scan.model,
    summary: scan.summary,
    findings,
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
  };
}
