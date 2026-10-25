import { NextResponse } from "next/server";
import { z } from "zod";
import { clearStravaRefreshToken, saveStravaRefreshToken } from "@/lib/users/secrets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  refreshToken: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Strava refresh token" }, { status: 422 });
  }
  try {
    saveStravaRefreshToken(parsed.data.refreshToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save the Strava token";
    const status = message.includes("required") || message.includes("invite") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  try {
    clearStravaRefreshToken();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not remove the Strava token";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
