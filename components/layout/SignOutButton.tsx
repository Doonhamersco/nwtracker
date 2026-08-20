"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-bg-hover hover:text-text"
    >
      <LogOut size={16} />
      Sign out
    </button>
  )
}
