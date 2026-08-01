import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config.js";
import { AppError } from "./errors.js";

function encryptionKey(): Buffer {
  if (!config.CREDENTIAL_ENCRYPTION_KEY) {
    throw new AppError(
      503,
      "CREDENTIAL_STORAGE_UNAVAILABLE",
      "Personal API-key storage is not configured on this server.",
    );
  }
  const key = Buffer.from(config.CREDENTIAL_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new AppError(
      503,
      "CREDENTIAL_STORAGE_UNAVAILABLE",
      "The credential encryption key is invalid.",
    );
  }
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(payload: { encryptedValue: string; iv: string; authTag: string }) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
