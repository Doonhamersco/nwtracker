import { describe, it, expect } from "vitest";
import {
  createVerifier,
  decryptBytes,
  deriveMasterKey,
  encodeRecoveryKey,
  decodeRecoveryKey,
  encryptBytes,
  randomBytes,
  unwrapFileKey,
  verifyMasterKey,
  wrapFileKey,
} from "@/lib/crypto/diary";

describe("diary crypto", () => {
  it("encrypts and decrypts a payload", async () => {
    const fileKey = randomBytes(32);
    const plain = new TextEncoder().encode("hello diary");
    const encrypted = await encryptBytes(plain, fileKey);
    const decrypted = await decryptBytes(encrypted, fileKey);
    expect(new TextDecoder().decode(decrypted)).toBe("hello diary");
  });

  it("wraps a file key with the master key", async () => {
    const master = randomBytes(32);
    const fileKey = randomBytes(32);
    const wrapped = await wrapFileKey(fileKey, master);
    const unwrapped = await unwrapFileKey(wrapped.wrapped, wrapped.iv, master);
    expect(unwrapped).toEqual(fileKey);
  });

  it("derives a key and checks the verifier", async () => {
    const salt = randomBytes(16);
    const master = await deriveMasterKey("correct horse battery staple", salt);
    const verifier = await createVerifier(master);
    await expect(verifyMasterKey(master, verifier.iv, verifier.ciphertext)).resolves.toBe(true);
    const other = await deriveMasterKey("wrong passphrase!!", salt);
    await expect(verifyMasterKey(other, verifier.iv, verifier.ciphertext)).resolves.toBe(false);
  });

  it("round-trips a recovery key", () => {
    const master = randomBytes(32);
    const encoded = encodeRecoveryKey(master);
    expect(decodeRecoveryKey(encoded)).toEqual(master);
  });
});
