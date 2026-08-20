"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import NavSidebar from "./NavSidebar"
import { BrandMark } from "./BrandMark"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const [navPath, setNavPath] = useState(pathname)

  if (pathname !== navPath) {
    setNavPath(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("keydown", onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-bg-base px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text hover:bg-bg-card"
        >
          <Menu size={20} />
        </button>
        <BrandMark size="sm" />
      </header>

      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] border-r border-border transform transition-transform duration-200 ease-out md:static md:z-auto md:w-60 md:translate-x-0 md:transition-none ${
          open ? "translate-x-0" : "-translate-x-full max-md:pointer-events-none"
        }`}
      >
        <NavSidebar onClose={() => setOpen(false)} />
      </div>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 md:p-8 lg:px-10 lg:py-9">
        {children}
      </main>
    </div>
  )
}
