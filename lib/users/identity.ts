import { createHash } from "crypto";

export type UserScope = {
  email: string;
  userId: string;
};

/** Google addresses are case-insensitive. The hash and allowlist use this form. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalised = email.trim().toLowerCase();
  if (!normalised || !normalised.includes("@")) return null;
  return normalised;
}

export function userIdFromEmail(email: string): string {
  const normalised = normalizeEmail(email);
  if (!normalised) throw new Error("A valid email is required");
  return createHash("sha256").update(normalised).digest("hex");
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  for (const part of value.split(",")) {
    const email = normalizeEmail(part);
    if (email) seen.add(email);
  }
  return [...seen];
}

/**
 * Invite list. ALLOWED_EMAILS is comma-separated. ALLOWED_EMAIL is still
 * accepted and is unioned in, so an existing single-owner deploy keeps working
 * when the new variable is added.
 */
export function allowlist(): string[] {
  const seen = new Set<string>();
  for (const email of parseList(process.env.ALLOWED_EMAILS)) seen.add(email);
  const single = normalizeEmail(process.env.ALLOWED_EMAIL);
  if (single) seen.add(single);
  return [...seen];
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const normalised = normalizeEmail(email);
  if (!normalised) return false;
  return allowlist().includes(normalised);
}

/**
 * The account that already owns the on-disk data. ALLOWED_EMAIL wins so the
 * historical owner does not change if ALLOWED_EMAILS lists someone else first.
 * When only ALLOWED_EMAILS is set, the first address is the owner.
 */
export function ownerEmail(): string | null {
  const single = normalizeEmail(process.env.ALLOWED_EMAIL);
  if (single) return single;
  return parseList(process.env.ALLOWED_EMAILS)[0] ?? null;
}

export function ownerUserId(): string | null {
  const email = ownerEmail();
  return email ? userIdFromEmail(email) : null;
}

export function scopeFromEmail(email: string | null | undefined): UserScope | null {
  const normalised = normalizeEmail(email);
  if (!normalised || !isEmailAllowed(normalised)) return null;
  return { email: normalised, userId: userIdFromEmail(normalised) };
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const normalised = normalizeEmail(email);
  const owner = ownerEmail();
  return Boolean(normalised && owner && normalised === owner);
}
