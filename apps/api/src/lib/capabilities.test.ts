import { describe, expect, it } from "vitest";
import { createAccessCode, createManagementToken, sha256 } from "./capabilities";

describe("anonymous scan capabilities", () => {
  it("creates unique, case-sensitive, unambiguous 12-character access codes", () => {
    const codes = Array.from({ length: 1_000 }, () => createAccessCode());
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{12}$/);
      expect(code).not.toMatch(/[01IOl]/);
    }
  });

  it("creates independent 256-bit management tokens", () => {
    const tokens = Array.from({ length: 100 }, () => createManagementToken());
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("hashes capabilities without normalizing case", async () => {
    expect(await sha256("AbCd2345EfGh")).not.toBe(await sha256("abcd2345efgh"));
    expect(await sha256("AbCd2345EfGh")).toHaveLength(64);
  });
});
