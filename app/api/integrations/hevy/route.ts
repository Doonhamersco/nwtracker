import { NextResponse } from "next/server";
import { z } from "zod";
import { clearHevyApiKey, saveHevyApiKey } from "@/lib/users/secrets";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  apiKey: z.string().trim().min(1).max(500),
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
    return NextResponse.json({ error: "Invalid Hevy API key" }, { status: 422 });
  }
  try {
    saveHevyApiKey(parsed.data.apiKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save the Hevy API key";
    const status = message.includes("required") || message.includes("invite") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  try {
    clearHevyApiKey();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not remove the Hevy API key";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
