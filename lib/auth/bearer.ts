import { createHash, timingSafeEqual } from "crypto";

function extractBearer(authorization: string | null | undefined): string {
  if (!authorization) return "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  return match?.[1] ?? "";
}

/**
 * Constant-time comparison of an Authorization bearer token with a secret.
 * Returns false when the secret is unset so the feature stays disabled.
 * Both sides are hashed before compare so differing lengths do not throw
 * or short-circuit inside timingSafeEqual.
 */
export function bearerMatches(
  authorization: string | null | undefined,
  secret: string | undefined | null
): boolean {
  if (!secret) return false;
  const provided = extractBearer(authorization);
  const actual = createHash("sha256").update(provided).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(actual, expected);
}
