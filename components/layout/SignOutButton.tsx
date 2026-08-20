"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#94A3B8] transition-colors hover:bg-[#111111] hover:text-[#F1F5F9]"
    >
      <LogOut size={16} />
      Sign out
    </button>
  )
}
