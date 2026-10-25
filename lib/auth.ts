import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { isEmailAllowed } from "@/lib/users/identity"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    async signIn({ user }) {
      return isEmailAllowed(user.email)
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email
      return token
    },
    async session({ session, token }) {
      if (typeof token.email === "string" && session.user) {
        session.user.email = token.email
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
