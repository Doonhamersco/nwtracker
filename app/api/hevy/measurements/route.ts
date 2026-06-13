import { NextRequest, NextResponse } from "next/server";
import { hevyClient, HevyApiError } from "@/lib/hevy/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(Number(searchParams.get("pageSize") ?? "10"), 100);

  try {
    const data = await hevyClient.getBodyMeasurements(page, pageSize);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof HevyApiError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status === 401 ? 401 : 502 },
      );
    }
    console.error("[hevy/measurements]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
