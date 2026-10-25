import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { USER_EMAIL_HEADER } from "@/lib/users/headers";

type HeaderStore = {
  type?: string;
  headers?: { get(name: string): string | null };
};

/**
 * Next.js keeps the request headers on the work-unit store. `headers()` is
 * async in this version, and SQLite queries are synchronous, so data access
 * reads the same store directly. The proxy overwrites the header from the
 * verified session before the route runs.
 */
export function readRequestIdentity(): { inRequest: boolean; email: string | null } {
  if (process.env.VITEST || process.env.NEXT_PHASE === "phase-production-build") {
    return { inRequest: false, email: null };
  }
  try {
    const store = workUnitAsyncStorage.getStore() as HeaderStore | undefined;
    if (!store) return { inRequest: false, email: null };
    const inRequest =
      store.type === "request" ||
      store.type === "prerender-runtime" ||
      store.type === "private-cache";
    if (!inRequest || !store.headers || typeof store.headers.get !== "function") {
      return { inRequest: false, email: null };
    }
    return { inRequest: true, email: store.headers.get(USER_EMAIL_HEADER) };
  } catch {
    return { inRequest: false, email: null };
  }
}
