import crypto from "node:crypto";
import { env } from "./env";

/**
 * AES-256-GCM symmetric encryption for OAuth tokens at rest.
 *
 * - 32-byte key derived from ENCRYPTION_KEY (base64)
 * - 12-byte random IV per encryption
 * - 16-byte auth tag verified on decrypt
 *
 * Output format: { ciphertext, iv, authTag } each as base64 strings.
 * Store all three in the database; never derive the IV from the ciphertext.
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes (base64-encoded). Got ${key.length} bytes.`,
    );
  }
  return key;
}

export interface EncryptedData {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

export function encrypt(plaintext: string): EncryptedData {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decrypt(data: EncryptedData): string {
  const key = getKey();
  const iv = Buffer.from(data.iv, "base64");
  const ciphertext = Buffer.from(data.ciphertext, "base64");
  const authTag = Buffer.from(data.authTag, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: ${iv.length}, expected ${IV_LENGTH}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `Invalid auth tag length: ${authTag.length}, expected ${AUTH_TAG_LENGTH}`,
    );
  }

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * HMAC-SHA256 signing for session cookies and state parameters.
 */
export function sign(value: string): string {
  return crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

export function verify(value: string, signature: string): boolean {
  const expected = sign(value);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
}

/**
 * Generate a random URL-safe token (for OAuth state, CSRF tokens, etc.)
 */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
