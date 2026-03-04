import crypto from "node:crypto";
import { UserError } from "./errors";

const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function readKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new UserError("Invalid encryption key. Expected a 32-byte base64 key.");
  }

  return key;
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString("base64");
}

export function encrypt(plaintext: string, keyBase64: string): string {
  const key = readKey(keyBase64);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(encryptedBase64: string, keyBase64: string): string {
  const key = readKey(keyBase64);
  const payload = Buffer.from(encryptedBase64, "base64");

  if (payload.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new UserError("Decryption failed. Wrong encryption key?");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new UserError("Decryption failed. Wrong encryption key?");
  }
}
