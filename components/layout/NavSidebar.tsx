"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  Activity,
  Film,
  Target,
  BarChart2,
  Compass,
  Settings,
  X,
} from "lucide-react"
import { useSession } from "next-auth/react"
import SignOutButton from "./SignOutButton"
import { BrandMark } from "./BrandMark"
import { useProfileOptional } from "./ProfileProvider"
import { DATE_OF_BIRTH } from "@/lib/constants"

const DOB = new Date(DATE_OF_BIRTH)

function getCurrentAge(): number {
  const today = new Date()
  let age = today.getFullYear() - DOB.getFullYear()
  const hasBirthdayPassedThisYear =
    today.getMonth() > DOB.getMonth() ||
    (today.getMonth() === DOB.getMonth() && today.getDate() >= DOB.getDate())
  if (!hasBirthdayPassedThisYear) age -= 1
  return age
}

const navLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/assets", label: "Accounts", icon: Wallet },
  { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/metrics", label: "Life Metrics", icon: Activity },
  { href: "/diaries", label: "Diaries", icon: Film },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/plan", label: "Plan", icon: Compass },
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
  const profile = useProfileOptional()
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
        <Link
          href="/settings?tab=profile"
          onClick={onClose}
          className="mt-2 flex items-center gap-3 rounded-xl bg-bg-card px-3 py-3 transition-colors hover:bg-bg-hover"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 font-display text-xs text-accent">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsFrom(email)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-text">{displayName}</p>
            <p className="text-xs text-accent">Age {getCurrentAge()}</p>
          </div>
        </Link>
      </div>
    </aside>
  )
}
