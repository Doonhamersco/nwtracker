/**
 * Client-side diary cryptography. The passphrase and master key never leave the device.
 */

import { argon2id } from "hash-wasm";

export const MAGIC = new Uint8Array([0x4e, 0x57, 0x31, 0x44]); // "NW1D"
export const FORMAT_VERSION = 1;
export const CHUNK_SIZE = 1024 * 1024;
export const MIN_PASSPHRASE_LENGTH = 12;
export const VERIFIER_PLAINTEXT = "nwtracker-diary-v1";
export const CRYPTO_ID = "default";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = 9; // magic(4) + version(1) + chunkSize(4)

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  return argon2id({
    password: passphrase,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 19456,
    hashLength: 32,
    outputType: "binary",
  });
}

function toArrayBuffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function aesEncrypt(
  keyBytes: Uint8Array,
  plaintext: Uint8Array
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = randomBytes(IV_LENGTH);
  const key = await importAesKey(keyBytes);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(plaintext))
  );
  return { iv, ciphertext: ct };
}

async function aesDecrypt(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array> {
  const key = await importAesKey(keyBytes);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(ciphertext))
  );
}

export async function createVerifier(masterKey: Uint8Array): Promise<{
  iv: Uint8Array;
  ciphertext: Uint8Array;
}> {
  const encoded = new TextEncoder().encode(VERIFIER_PLAINTEXT);
  return aesEncrypt(masterKey, encoded);
}

export async function verifyMasterKey(
  masterKey: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Promise<boolean> {
  try {
    const plain = await aesDecrypt(masterKey, iv, ciphertext);
    return new TextDecoder().decode(plain) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

export function encodeRecoveryKey(masterKey: Uint8Array): string {
  return bytesToBase64(masterKey);
}

export function decodeRecoveryKey(value: string): Uint8Array {
  const cleaned = value.trim().replace(/\s+/g, "");
  const bytes = base64ToBytes(cleaned);
  if (bytes.length !== 32) {
    throw new CryptoError("Recovery key must be a 32-byte key");
  }
  return bytes;
}

export async function wrapFileKey(
  fileKey: Uint8Array,
  masterKey: Uint8Array
): Promise<{ iv: Uint8Array; wrapped: Uint8Array }> {
  const { iv, ciphertext } = await aesEncrypt(masterKey, fileKey);
  return { iv, wrapped: ciphertext };
}

export async function unwrapFileKey(
  wrapped: Uint8Array,
  iv: Uint8Array,
  masterKey: Uint8Array
): Promise<Uint8Array> {
  return aesDecrypt(masterKey, iv, wrapped);
}

function writeHeader(chunkSize: number): Uint8Array {
  const header = new Uint8Array(HEADER_LENGTH);
  header.set(MAGIC, 0);
  header[4] = FORMAT_VERSION;
  new DataView(header.buffer).setUint32(5, chunkSize, false);
  return header;
}

function readHeader(data: Uint8Array): { chunkSize: number } {
  if (data.length < HEADER_LENGTH) throw new CryptoError("File is too short");
  for (let i = 0; i < MAGIC.length; i++) {
    if (data[i] !== MAGIC[i]) throw new CryptoError("Not an encrypted diary file");
  }
  if (data[4] !== FORMAT_VERSION) {
    throw new CryptoError(`Unsupported encryption version: ${data[4]}`);
  }
  const chunkSize = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
    5,
    false
  );
  if (chunkSize < 1024 || chunkSize > 16 * 1024 * 1024) {
    throw new CryptoError("Invalid chunk size");
  }
  return { chunkSize };
}

export async function encryptBytes(
  plaintext: Uint8Array,
  fileKey: Uint8Array,
  chunkSize = CHUNK_SIZE
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [writeHeader(chunkSize)];
  for (let offset = 0; offset < plaintext.length; offset += chunkSize) {
    const slice = plaintext.subarray(offset, offset + chunkSize);
    const { iv, ciphertext } = await aesEncrypt(fileKey, slice);
    const part = new Uint8Array(iv.length + ciphertext.length);
    part.set(iv, 0);
    part.set(ciphertext, iv.length);
    parts.push(part);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

export async function decryptBytes(
  ciphertext: Uint8Array,
  fileKey: Uint8Array
): Promise<Uint8Array> {
  const { chunkSize } = readHeader(ciphertext);
  const pieces: Uint8Array[] = [];
  let offset = HEADER_LENGTH;
  while (offset < ciphertext.length) {
    if (offset + IV_LENGTH + TAG_LENGTH > ciphertext.length) {
      throw new CryptoError("Truncated encrypted file");
    }
    const remaining = ciphertext.length - offset - IV_LENGTH - TAG_LENGTH;
    const plainLen = Math.min(chunkSize, remaining);
    const frameLen = IV_LENGTH + plainLen + TAG_LENGTH;
    const iv = ciphertext.subarray(offset, offset + IV_LENGTH);
    const frame = ciphertext.subarray(offset + IV_LENGTH, offset + frameLen);
    pieces.push(await aesDecrypt(fileKey, iv, frame));
    offset += frameLen;
  }
  const total = pieces.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of pieces) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

export async function encryptBlob(
  blob: Blob,
  fileKey: Uint8Array,
  onProgress?: (ratio: number) => void
): Promise<{ blob: Blob; chunkSize: number; bytes: number }> {
  const plaintext = new Uint8Array(await blob.arrayBuffer());
  onProgress?.(0.15);
  const encrypted = await encryptBytes(plaintext, fileKey);
  onProgress?.(1);
  return {
    blob: new Blob([toArrayBuffer(encrypted)], { type: "application/octet-stream" }),
    chunkSize: CHUNK_SIZE,
    bytes: encrypted.byteLength,
  };
}

export async function decryptToBlob(
  ciphertext: Uint8Array,
  fileKey: Uint8Array,
  mimeType: string
): Promise<Blob> {
  const plain = await decryptBytes(ciphertext, fileKey);
  return new Blob([toArrayBuffer(plain)], { type: mimeType || "video/mp4" });
}
