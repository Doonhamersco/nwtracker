import { NextRequest, NextResponse } from "next/server";
import { getSpendingReport } from "@/lib/services/spending";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { error: "month must be YYYY-MM" },
      { status: 400 }
    );
  }

  try {
    const report = getSpendingReport(month);
    return NextResponse.json(report);
  } catch (err) {
    console.error("[GET /api/spending]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load spending", detail: message },
      { status: 500 }
    );
  }
}
