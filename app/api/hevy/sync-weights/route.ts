import { NextResponse } from "next/server";
import { hevyClient, HevyApiError } from "@/lib/hevy/client";
import { createWeightReading } from "@/lib/services/weight";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const measurements = await hevyClient.getAllBodyMeasurements();

    const withWeight = measurements.filter((m) => m.weight_kg != null);

    let synced = 0;
    for (const m of withWeight) {
      createWeightReading(m.date, m.weight_kg!);
      synced++;
    }

    return NextResponse.json({ ok: true, synced });
  } catch (err) {
    if (err instanceof HevyApiError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status === 401 ? 401 : 502 },
      );
    }
    console.error("[hevy/sync-weights]", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
