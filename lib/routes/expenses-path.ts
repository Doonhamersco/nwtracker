/**
 * Page paths that still say "subscriptions" go to the expenses route.
 * API paths stay put so existing clients and stored data keep working.
 */
export function pagePathContainingSubscriptions(pathname: string): string | null {
  const pathOnly = pathname.split("?")[0] ?? pathname;
  if (pathOnly === "/api" || pathOnly.startsWith("/api/")) return null;
  if (!pathOnly.toLowerCase().includes("subscriptions")) return null;
  const next = pathOnly.replace(/subscriptions/gi, "expenses");
  return next === pathOnly ? null : next;
}
