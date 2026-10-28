import { NextRequest, NextResponse } from "next/server";
import { mergeAccounts } from "@/lib/services/account-merge";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetId =
    body && typeof body === "object" && "targetId" in body && typeof body.targetId === "string"
      ? body.targetId
      : "";
  if (!targetId) {
    return NextResponse.json({ error: "targetId is required" }, { status: 422 });
  }

  try {
    const report = mergeAccounts({ sourceId: id, targetId });
    if (report.status === "refused") {
      return NextResponse.json({ error: report.reason, ...report }, { status: 422 });
    }
    if (report.status === "nothing-to-merge") {
      return NextResponse.json({ error: report.reason, ...report }, { status: 404 });
    }
    return NextResponse.json(report);
  } catch (err) {
    console.error("[POST /api/accounts/[id]/merge]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to merge account", detail: message }, { status: 500 });
  }
}
