import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer
    .from("0123456789abcdef0123456789abcdef")
    .toString("base64");
});

describe("credential encryption", () => {
  it("encrypts and decrypts without retaining plaintext", async () => {
    const { decryptSecret, encryptSecret } = await import("./crypto.js");
    const secret = "gemini-secret-value";
    const first = encryptSecret(secret);
    const second = encryptSecret(secret);

    expect(first.encryptedValue).not.toContain(secret);
    expect(first.encryptedValue).not.toBe(second.encryptedValue);
    expect(decryptSecret(first)).toBe(secret);
  });
});
