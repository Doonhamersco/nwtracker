import { describe, it, expect, beforeEach, afterEach } from "vitest"

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

describe("middleware route protection logic", () => {
  function shouldRedirectToLogin(
    pathname: string,
    isLoggedIn: boolean
  ): boolean {
    const isAuthRoute =
      pathname.startsWith("/login") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/hevy")

    return !isLoggedIn && !isAuthRoute
  }

  it("redirects unauthenticated users from protected routes", () => {
    expect(shouldRedirectToLogin("/dashboard", false)).toBe(true)
    expect(shouldRedirectToLogin("/assets", false)).toBe(true)
    expect(shouldRedirectToLogin("/metrics", false)).toBe(true)
  })

  it("does not redirect authenticated users from protected routes", () => {
    expect(shouldRedirectToLogin("/dashboard", true)).toBe(false)
    expect(shouldRedirectToLogin("/assets", true)).toBe(false)
  })

  it("does not redirect anyone from auth routes", () => {
    expect(shouldRedirectToLogin("/login", false)).toBe(false)
    expect(shouldRedirectToLogin("/api/auth/signin", false)).toBe(false)
    expect(shouldRedirectToLogin("/api/auth/callback/google", false)).toBe(false)
  })

  it("does not redirect anyone from hevy API routes", () => {
    expect(shouldRedirectToLogin("/api/hevy/sync", false)).toBe(false)
  })
})
