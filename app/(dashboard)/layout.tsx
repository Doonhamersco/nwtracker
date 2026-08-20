import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import NavSidebar from "@/components/layout/NavSidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="flex h-full">
      <NavSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  )
}
