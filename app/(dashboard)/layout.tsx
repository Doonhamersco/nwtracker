import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AppShell from "@/components/layout/AppShell"
import { ProfileProvider } from "@/components/layout/ProfileProvider"
import { getSettings } from "@/lib/services/profile"
import { themeStyleText } from "@/lib/profile-theme"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const settings = getSettings()

  return (
    <ProfileProvider
      initialAccentColor={settings.accentColor}
      hasAvatar={settings.hasAvatar}
      updatedAt={settings.updatedAt}
    >
      <style
        dangerouslySetInnerHTML={{ __html: themeStyleText(settings.accentColor) }}
      />
      <AppShell>{children}</AppShell>
    </ProfileProvider>
  )
}
