"use client"

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { DEFAULT_ACCENT_COLOR, themeCssVars } from "@/lib/profile-theme"

type ProfileContextValue = {
  accentColor: string
  avatarUrl: string | null
  setAccentColor: (color: string) => void
  setAvatar: (hasAvatar: boolean, updatedAt: string | null) => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

const THEME_VAR_KEYS = Object.keys(themeCssVars(DEFAULT_ACCENT_COLOR))

function applyThemeVars(accentColor: string) {
  const root = document.documentElement
  const vars = themeCssVars(accentColor)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

export function ProfileProvider({
  initialAccentColor,
  hasAvatar,
  updatedAt,
  children,
}: {
  initialAccentColor: string
  hasAvatar: boolean
  updatedAt: string | null
  children: ReactNode
}) {
  const [accentColor, setAccentColor] = useState(initialAccentColor)
  const [avatarState, setAvatarState] = useState({ hasAvatar, updatedAt })

  const avatarUrl = avatarState.hasAvatar
    ? `/api/profile/avatar?v=${encodeURIComponent(avatarState.updatedAt ?? "1")}`
    : null

  useLayoutEffect(() => {
    applyThemeVars(accentColor)
    return () => {
      for (const key of THEME_VAR_KEYS) {
        document.documentElement.style.removeProperty(key)
      }
    }
  }, [accentColor])

  const value = useMemo<ProfileContextValue>(
    () => ({
      accentColor,
      avatarUrl,
      setAccentColor,
      setAvatar: (nextHasAvatar, nextUpdatedAt) => {
        setAvatarState({ hasAvatar: nextHasAvatar, updatedAt: nextUpdatedAt })
      },
    }),
    [accentColor, avatarUrl]
  )

  return (
    <ProfileContext.Provider value={value}>
      <div className="h-full" style={themeCssVars(accentColor) as CSSProperties}>
        {children}
      </div>
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider")
  return ctx
}

export function useProfileOptional(): ProfileContextValue | null {
  return useContext(ProfileContext)
}

export function useAccentColor(): string {
  return useProfileOptional()?.accentColor ?? DEFAULT_ACCENT_COLOR
}
