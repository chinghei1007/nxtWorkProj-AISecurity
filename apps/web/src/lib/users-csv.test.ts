import { describe, expect, it } from "vitest";
import { batchTemplateCsv, credentialsCsv, parseBatchCsv, toIsoOrOriginal } from "./users-csv";

describe("batch user CSV", () => {
  it("parses quoted values and normalizes role and tier labels", () => {
    const rows = parseBatchCsv('username,temporaryPassword,role,accessTier,expiresAt\n"demo,user",,user,full demo,2026-12-31T23:59:00Z');
    expect(rows[0]).toMatchObject({ username: "demo,user", role: "USER", accessTier: "FULL_DEMO", expiresAt: "2026-12-31T23:59:00Z" });
  });

  it("preserves invalid entitlement values for per-row server validation", () => {
    const rows = parseBatchCsv("username,role,accessTier\ndemo,SUPER,VIP");
    expect(rows[0]).toMatchObject({ role: "SUPER", accessTier: "VIP" });
  });

  it("creates stable template and one-time credential exports", () => {
    expect(batchTemplateCsv()).toContain("temporaryPassword");
    const output = credentialsCsv([{ username: "demo", temporaryPassword: "GeneratedPass123!", role: "USER", accessTier: "LIMITED", expiresAt: null }]);
    expect(output).toContain("GeneratedPass123!");
  });

  it("converts valid local timestamps while leaving malformed input for validation", () => {
    expect(toIsoOrOriginal("2026-12-31T23:59")).toMatch(/^2026-12-/);
    expect(toIsoOrOriginal("not-a-date")).toBe("not-a-date");
  });
});
