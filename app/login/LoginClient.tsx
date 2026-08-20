"use client"

import { signIn } from "next-auth/react"
import { BrandMark } from "@/components/layout/BrandMark"

interface LoginClientProps {
  error?: string
}

export default function LoginClient({ error }: LoginClientProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center">
          <BrandMark size="lg" className="mb-3 justify-center" />
          <p className="mt-2 text-muted">Personal net worth &amp; life metrics</p>
        </div>

        {error && (
          <div className="rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-center text-sm text-negative">
            Access denied. Only authorised accounts may sign in.
          </div>
        )}

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" }, { prompt: "select_account" })}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-bg-card px-4 py-3 text-sm font-medium text-text transition-colors hover:bg-bg-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-base"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  )
}
