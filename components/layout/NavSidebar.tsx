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

// Date of birth — born January 1, 2005 (was 16 years old in January 2021)
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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Wallet },
  { href: "/metrics", label: "Life Metrics", icon: Activity },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
]

export default function NavSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="flex h-full w-full flex-col border-r border-[#222222] bg-[#0a0a0a] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22c55e]">
            <span className="text-sm font-bold text-white">N</span>
          </div>
          <span className="font-semibold text-[#F1F5F9]">Tracker</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#111111] hover:text-[#F1F5F9] md:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-[#111111] text-[#F1F5F9]"
                  : "text-[#94A3B8] hover:bg-[#111111] hover:text-[#F1F5F9]"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[#222222] px-2 py-3">
        {session?.user?.email && (
          <p className="mb-1 truncate px-3 text-xs text-[#94A3B8]">{session.user.email}</p>
        )}
        <div className="mb-2 flex items-center gap-1.5 px-3">
          <span className="text-xs text-[#64748B]">Age</span>
          <span className="rounded-md bg-[#111111] px-1.5 py-0.5 text-xs font-semibold text-[#22c55e]">
            {getCurrentAge()}
          </span>
        </div>
        <SignOutButton />
      </div>
    </aside>
  )
}
