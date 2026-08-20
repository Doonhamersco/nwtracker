"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Wallet,
  Activity,
  Target,
  BarChart2,
  Settings,
  X,
} from "lucide-react"
import { useSession } from "next-auth/react"
import SignOutButton from "./SignOutButton"
import { BrandMark } from "./BrandMark"

const DATE_OF_BIRTH = new Date("2005-01-01")

function getCurrentAge(): number {
  const today = new Date()
  let age = today.getFullYear() - DATE_OF_BIRTH.getFullYear()
  const hasBirthdayPassedThisYear =
    today.getMonth() > DATE_OF_BIRTH.getMonth() ||
    (today.getMonth() === DATE_OF_BIRTH.getMonth() && today.getDate() >= DATE_OF_BIRTH.getDate())
  if (!hasBirthdayPassedThisYear) age -= 1
  return age
}

const navLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/assets", label: "Accounts", icon: Wallet },
  { href: "/metrics", label: "Life Metrics", icon: Activity },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/reports", label: "Reports", icon: BarChart2 },
]

function initialsFrom(email: string | null | undefined) {
  if (!email) return "T"
  const name = email.split("@")[0] ?? "T"
  return name.slice(0, 2).toUpperCase()
}

export default function NavSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const email = session?.user?.email ?? null
  const displayName = session?.user?.name ?? email?.split("@")[0] ?? "You"

  return (
    <aside className="flex h-full w-full flex-col bg-bg-base pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-5 py-6">
        <BrandMark />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-bg-card hover:text-text md:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-accent/10 text-text"
                  : "text-muted hover:bg-bg-hover hover:text-text"
              }`}
            >
              <Icon size={16} className={isActive ? "text-accent" : ""} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-1 px-3 pb-3">
        <Link
          href="/settings"
          onClick={onClose}
          className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname.startsWith("/settings")
              ? "bg-accent/10 text-text"
              : "text-muted hover:bg-bg-hover hover:text-text"
          }`}
        >
          <Settings size={16} className={pathname.startsWith("/settings") ? "text-accent" : ""} />
          Settings
        </Link>
        <SignOutButton />
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-bg-card px-3 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 font-display text-xs text-accent">
            {initialsFrom(email)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-text">{displayName}</p>
            <p className="text-xs text-accent">Age {getCurrentAge()}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
