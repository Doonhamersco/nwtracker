import { describe, it, expect } from "vitest"
import { proxyDecision } from "@/lib/auth/proxy-access"

/**
 * Tests for the auth configuration logic.
 * Extracts the pure email-checking logic from lib/auth.ts signIn callback.
 */

function isEmailAllowed(userEmail: string | null | undefined, allowedEmail: string | undefined): boolean {
  if (!allowedEmail) return false
  return userEmail === allowedEmail
}

function isAuthorized(authSession: { user?: unknown } | null): boolean {
  return !!authSession?.user
}

describe("auth signIn callback logic", () => {
  describe("isEmailAllowed", () => {
    it("returns false when ALLOWED_EMAIL is not set", () => {
      expect(isEmailAllowed("user@example.com", undefined)).toBe(false)
    })

    it("returns false when ALLOWED_EMAIL is empty string", () => {
      expect(isEmailAllowed("user@example.com", "")).toBe(false)
    })

    it("returns true when email matches ALLOWED_EMAIL", () => {
      expect(isEmailAllowed("owner@example.com", "owner@example.com")).toBe(true)
    })

    it("returns false when email does not match ALLOWED_EMAIL", () => {
      expect(isEmailAllowed("stranger@example.com", "owner@example.com")).toBe(false)
    })

    it("returns false when user email is null", () => {
      expect(isEmailAllowed(null, "owner@example.com")).toBe(false)
    })

    it("returns false when user email is undefined", () => {
      expect(isEmailAllowed(undefined, "owner@example.com")).toBe(false)
    })

    it("is case-sensitive", () => {
      expect(isEmailAllowed("Owner@Example.com", "owner@example.com")).toBe(false)
    })
  })

  describe("isAuthorized (authorized callback logic)", () => {
    it("returns false when auth session is null", () => {
      expect(isAuthorized(null)).toBe(false)
    })

    it("returns false when auth session has no user", () => {
      expect(isAuthorized({ user: undefined })).toBe(false)
    })

    it("returns true when auth session has a user", () => {
      expect(isAuthorized({ user: { email: "owner@example.com" } })).toBe(true)
    })
  })
})

describe("proxy route protection", () => {
  it("redirects unauthenticated users from protected routes", () => {
    expect(proxyDecision({ pathname: "/dashboard", isLoggedIn: false })).toBe("redirect")
    expect(proxyDecision({ pathname: "/assets", isLoggedIn: false })).toBe("redirect")
    expect(proxyDecision({ pathname: "/fitness", isLoggedIn: false })).toBe("redirect")
    expect(proxyDecision({ pathname: "/spending", isLoggedIn: false })).toBe("redirect")
    expect(proxyDecision({ pathname: "/metrics", isLoggedIn: false })).toBe("redirect")
    expect(proxyDecision({ pathname: "/api/hevy/stats", isLoggedIn: false })).toBe("redirect")
    expect(proxyDecision({ pathname: "/api/hevy/sync-weights", isLoggedIn: false })).toBe("redirect")
  })

  it("allows authenticated users through protected routes", () => {
    expect(proxyDecision({ pathname: "/dashboard", isLoggedIn: true })).toBe("allow")
    expect(proxyDecision({ pathname: "/api/hevy/sync", isLoggedIn: true })).toBe("allow")
    expect(proxyDecision({ pathname: "/api/hevy/stats", isLoggedIn: true })).toBe("allow")
  })

  it("allows login and auth routes without a session", () => {
    expect(proxyDecision({ pathname: "/login", isLoggedIn: false })).toBe("allow")
    expect(proxyDecision({ pathname: "/api/auth/signin", isLoggedIn: false })).toBe("allow")
    expect(proxyDecision({ pathname: "/api/auth/callback/google", isLoggedIn: false })).toBe("allow")
  })

  it("rejects anonymous Hevy sync unless the cron bearer matches", () => {
    expect(proxyDecision({ pathname: "/api/hevy/sync", isLoggedIn: false })).toBe("unauthorized")
    expect(
      proxyDecision({
        pathname: "/api/hevy/sync",
        isLoggedIn: false,
        authorization: "Bearer wrong",
        hevySyncToken: "cron-secret",
      })
    ).toBe("unauthorized")
    expect(
      proxyDecision({
        pathname: "/api/hevy/sync",
        isLoggedIn: false,
        authorization: "Bearer cron-secret",
        hevySyncToken: "cron-secret",
      })
    ).toBe("allow")
    expect(
      proxyDecision({
        pathname: "/api/hevy/sync",
        isLoggedIn: false,
        authorization: "Bearer cron-secret",
      })
    ).toBe("unauthorized")
  })

  it("lets the import route through so it can check its own bearer", () => {
    expect(
      proxyDecision({ pathname: "/api/import/transactions", isLoggedIn: false })
    ).toBe("allow")
  })

  it("keeps dev layout previews open and closes them in production", () => {
    expect(
      proxyDecision({
        pathname: "/preview/fitness",
        isLoggedIn: false,
        nodeEnv: "development",
      })
    ).toBe("allow")
    expect(
      proxyDecision({
        pathname: "/preview/spending",
        isLoggedIn: false,
        nodeEnv: "test",
      })
    ).toBe("allow")
    expect(
      proxyDecision({
        pathname: "/preview/overview",
        isLoggedIn: false,
        nodeEnv: "production",
      })
    ).toBe("redirect")
  })
})
