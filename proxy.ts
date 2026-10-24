import { auth } from "@/lib/auth"
import { proxyDecision } from "@/lib/auth/proxy-access"

export default auth((req) => {
  const decision = proxyDecision({
    pathname: req.nextUrl.pathname,
    isLoggedIn: !!req.auth?.user,
    authorization: req.headers.get("authorization"),
    hevySyncToken: process.env.HEVY_SYNC_TOKEN,
    nodeEnv: process.env.NODE_ENV,
  })

  if (decision === "allow") return
  if (decision === "unauthorized") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return Response.redirect(new URL("/login", req.nextUrl))
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}
