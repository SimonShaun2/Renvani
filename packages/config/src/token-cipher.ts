import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function keyFromSecret(secret: string): Buffer {
  if (secret.length < 32) {
    throw new Error("Token encryption key must be at least 32 characters");
  }
  return Buffer.from(secret.slice(0, 32), "utf8");
}

/** Encrypts a UTF-8 string for storage; output is `iv:tag:ciphertext` (base64 segments). */
export function encryptSecret(plaintext: string, encryptionKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyFromSecret(encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(payload: string, encryptionKey: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted secret payload");
  }
  const decipher = createDecipheriv(ALGORITHM, keyFromSecret(encryptionKey), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
