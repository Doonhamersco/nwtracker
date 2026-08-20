import { NextResponse } from "next/server";
import { exportToJson } from "@/lib/services/export";

export async function GET() {
  try {
    const payload = exportToJson();
    const date = new Date().toISOString().slice(0, 10);
    const filename = `nwtracker-export-${date}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/export/json]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to export JSON", detail: message },
      { status: 500 }
    );
  }
}
