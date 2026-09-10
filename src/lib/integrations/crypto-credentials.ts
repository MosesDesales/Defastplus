import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function key32(): Buffer {
  const secret = process.env.AUTH_SECRET ?? process.env.INTEGRATIONS_SECRET ?? "";
  if (secret.length < 16) throw new Error("AUTH_SECRET (or INTEGRATIONS_SECRET) required for integration encryption");
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Encrypt JSON object → base64(iv+ciphertext+tag). */
export function encryptCredentials(obj: Record<string, unknown>): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key32(), iv, { authTagLength: TAG_LEN });
  const plain = JSON.stringify(obj);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

export function decryptCredentials(payload: string): Record<string, unknown> {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(raw.length - TAG_LEN);
  const data = raw.subarray(IV_LEN, raw.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key32(), iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(dec) as Record<string, unknown>;
}
