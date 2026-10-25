import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { proxyDecision } from "@/lib/auth/proxy-access"
import { stampUserHeader } from "@/lib/users/headers"
import { isEmailAllowed } from "@/lib/users/identity"

export default auth((req) => {
  const sessionEmail = req.auth?.user?.email
  const decision = proxyDecision({
    pathname: req.nextUrl.pathname,
    isLoggedIn: !!req.auth?.user && isEmailAllowed(sessionEmail),
    authorization: req.headers.get("authorization"),
    hevySyncToken: process.env.HEVY_SYNC_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  })

  if (decision === "unauthorized") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (decision === "redirect") {
    return Response.redirect(new URL("/login", req.nextUrl))
  }

  const requestHeaders = stampUserHeader(req.headers, req.auth?.user?.email)
  return NextResponse.next({ request: { headers: requestHeaders } })
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}
