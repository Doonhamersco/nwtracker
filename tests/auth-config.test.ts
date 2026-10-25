import { afterEach, describe, expect, it } from "vitest"
import { proxyDecision } from "@/lib/auth/proxy-access"
import { isEmailAllowed, ownerEmail, userIdFromEmail } from "@/lib/users/identity"
import { stampUserHeader } from "@/lib/users/headers"
import { resolveImportTarget } from "@/lib/users/import-target"

function isAuthorized(authSession: { user?: unknown } | null): boolean {
  return !!authSession?.user
}

describe("auth signIn callback logic", () => {
  const previous = {
    ALLOWED_EMAIL: process.env.ALLOWED_EMAIL,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
  }

  afterEach(() => {
    if (previous.ALLOWED_EMAIL === undefined) delete process.env.ALLOWED_EMAIL
    else process.env.ALLOWED_EMAIL = previous.ALLOWED_EMAIL
    if (previous.ALLOWED_EMAILS === undefined) delete process.env.ALLOWED_EMAILS
    else process.env.ALLOWED_EMAILS = previous.ALLOWED_EMAILS
  })

  describe("isEmailAllowed", () => {
    it("returns false when no invite list is set", () => {
      delete process.env.ALLOWED_EMAIL
      delete process.env.ALLOWED_EMAILS
      expect(isEmailAllowed("user@example.com")).toBe(false)
    })

    it("returns false when ALLOWED_EMAIL is empty", () => {
      process.env.ALLOWED_EMAIL = "  "
      delete process.env.ALLOWED_EMAILS
      expect(isEmailAllowed("user@example.com")).toBe(false)
    })

    it("keeps ALLOWED_EMAIL working and ignores letter case", () => {
      process.env.ALLOWED_EMAIL = "Owner@Example.com"
      delete process.env.ALLOWED_EMAILS
      expect(isEmailAllowed("owner@example.com")).toBe(true)
      expect(isEmailAllowed("stranger@example.com")).toBe(false)
    })

    it("allows every address in ALLOWED_EMAILS and unions ALLOWED_EMAIL", () => {
      process.env.ALLOWED_EMAIL = "owner@example.com"
      process.env.ALLOWED_EMAILS = "dad@example.com, , guest@example.com"
      expect(isEmailAllowed("dad@example.com")).toBe(true)
      expect(isEmailAllowed("Guest@Example.com")).toBe(true)
      expect(isEmailAllowed("owner@example.com")).toBe(true)
      expect(isEmailAllowed("stranger@example.com")).toBe(false)
    })

    it("returns false when the user email is missing", () => {
      process.env.ALLOWED_EMAIL = "owner@example.com"
      expect(isEmailAllowed(null)).toBe(false)
      expect(isEmailAllowed(undefined)).toBe(false)
    })

    it("uses a stable hash that does not contain the email", () => {
      const id = userIdFromEmail("Owner@Example.com")
      expect(id).toBe(userIdFromEmail("owner@example.com"))
      expect(id).toMatch(/^[0-9a-f]{64}$/)
      expect(id.includes("example")).toBe(false)
    })

    it("treats ALLOWED_EMAIL as the owner even when it is not first in the list", () => {
      process.env.ALLOWED_EMAIL = "owner@example.com"
      process.env.ALLOWED_EMAILS = "dad@example.com,owner@example.com"
      expect(ownerEmail()).toBe("owner@example.com")
    })

    it("stamps the session email and drops a client-supplied address", () => {
      process.env.ALLOWED_EMAILS = "owner@example.com,dad@example.com"
      delete process.env.ALLOWED_EMAIL
      const headers = new Headers({ "x-nw-user-email": "stranger@example.com" })
      expect(stampUserHeader(headers, "Dad@Example.com").get("x-nw-user-email")).toBe(
        "dad@example.com"
      )
      expect(stampUserHeader(headers, "stranger@example.com").has("x-nw-user-email")).toBe(false)
    })

    it("sends bearer imports to the owner unless the body names another invited person", () => {
      process.env.ALLOWED_EMAIL = "owner@example.com"
      process.env.ALLOWED_EMAILS = "dad@example.com"
      expect(resolveImportTarget(undefined)).toBe("owner@example.com")
      expect(resolveImportTarget("Dad@Example.com")).toBe("dad@example.com")
      expect(() => resolveImportTarget("stranger@example.com")).toThrow(/invite list/)
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
