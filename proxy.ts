import { auth } from "@/lib/auth"

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth?.user
  const isDevPreview =
    process.env.NODE_ENV !== "production" && nextUrl.pathname.startsWith("/preview")
  const isAuthRoute =
    nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/api/auth") ||
    nextUrl.pathname.startsWith("/api/hevy") ||
    isDevPreview

  if (!isLoggedIn && !isAuthRoute) {
    return Response.redirect(new URL("/login", nextUrl))
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}
