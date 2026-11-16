const WINDOW_MS = 60_000;
const MAX_POSTS = 10;

const posts = new Map<string, number[]>();

export function clientIpFromHeaders(headers: Headers): string {
  const fly = headers.get("fly-client-ip")?.trim();
  if (fly) return fly;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/** Sliding window. Returns false once this IP has already posted 10 times in the last minute. */
export function allowLeaderboardPost(ip: string, now = Date.now()): boolean {
  const recent = (posts.get(ip) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= MAX_POSTS) {
    posts.set(ip, recent);
    return false;
  }
  recent.push(now);
  posts.set(ip, recent);
  return true;
}

export function resetLeaderboardRateLimit(): void {
  posts.clear();
}
