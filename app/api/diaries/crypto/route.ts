import { NextRequest, NextResponse } from "next/server";
import { getDiaryCrypto, setupDiaryCrypto } from "@/lib/services/diaries";
import { diaryCryptoSetupSchema } from "@/lib/validators/diaries";

export async function GET() {
  try {
    const row = getDiaryCrypto();
    if (!row) {
      return NextResponse.json({ configured: false });
    }
    return NextResponse.json({
      configured: true,
      kdfSalt: row.kdfSalt,
      verifierIv: row.verifierIv,
      verifierCt: row.verifierCt,
    });
  } catch (err) {
    console.error("[GET /api/diaries/crypto]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to load crypto config", detail: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = diaryCryptoSetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const row = setupDiaryCrypto(parsed.data);
    return NextResponse.json(
      {
        configured: true,
        kdfSalt: row.kdfSalt,
        verifierIv: row.verifierIv,
        verifierCt: row.verifierCt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/diaries/crypto]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("already configured")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to save crypto config", detail: message }, { status: 500 });
  }
}
