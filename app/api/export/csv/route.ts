import { NextResponse } from "next/server";
import { exportToCsv } from "@/lib/services/export";

export async function GET() {
  try {
    const csv = exportToCsv();
    const date = new Date().toISOString().slice(0, 10);
    const filename = `nwtracker-export-${date}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/export/csv]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to export CSV", detail: message },
      { status: 500 }
    );
  }
}
