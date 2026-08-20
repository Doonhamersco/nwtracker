import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    async signIn({ user }) {
      const allowed = process.env.ALLOWED_EMAIL
      if (!allowed) return false
      return user.email === allowed
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
