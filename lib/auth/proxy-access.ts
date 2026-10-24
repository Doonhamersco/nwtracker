import { bearerMatches } from "@/lib/auth/bearer";

export type ProxyDecision = "allow" | "redirect" | "unauthorized";

/**
 * Session gate for the Next.js proxy.
 * `/api/import/transactions` is exempt here and authenticates itself.
 * `/api/hevy/sync` accepts a logged-in session or the HEVY_SYNC_TOKEN bearer.
 * Every other `/api/hevy/*` route requires a session.
 * Dev layout previews under `/preview` stay open outside production.
 */
export function proxyDecision(input: {
  pathname: string;
  isLoggedIn: boolean;
  authorization?: string | null;
  hevySyncToken?: string | null;
  nodeEnv?: string;
}): ProxyDecision {
  const { pathname, isLoggedIn } = input;
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/import/transactions" ||
    (nodeEnv !== "production" && pathname.startsWith("/preview"))
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
