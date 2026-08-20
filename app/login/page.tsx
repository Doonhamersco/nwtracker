import LoginClient from "./LoginClient"

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  return <LoginClient error={params.error} />
}
