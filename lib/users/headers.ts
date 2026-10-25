import { scopeFromEmail } from "@/lib/users/identity";

export const USER_EMAIL_HEADER = "x-nw-user-email";

/**
 * Replace any client-supplied identity header with the session email.
 * Addresses that are not on the invite list are left unset.
 */
export function stampUserHeader(
  headers: Headers,
  email: string | null | undefined
): Headers {
  const next = new Headers(headers);
  next.delete(USER_EMAIL_HEADER);
  const scope = scopeFromEmail(email);
  if (scope) next.set(USER_EMAIL_HEADER, scope.email);
  return next;
}
