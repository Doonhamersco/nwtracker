import { bearerMatches } from "@/lib/auth/bearer";

export type ProxyDecision = "allow" | "redirect" | "unauthorized";

/**
 * Session gate for the Next.js proxy.
 * `/api/import/transactions` is exempt here and authenticates itself.
 * `/api/hevy/sync` accepts a logged-in session or the HEVY_SYNC_TOKEN bearer.
 * Every other `/api/hevy/*` route requires a session.
 */
export function proxyDecision(input: {
  pathname: string;
  isLoggedIn: boolean;
  authorization?: string | null;
  hevySyncToken?: string | null;
}): ProxyDecision {
  const { pathname, isLoggedIn } = input;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/import/transactions"
  ) {
    return "allow";
  }

  if (pathname === "/api/hevy/sync") {
    if (isLoggedIn) return "allow";
    if (bearerMatches(input.authorization, input.hevySyncToken)) return "allow";
    return "unauthorized";
  }

  if (!isLoggedIn) return "redirect";
  return "allow";
}
