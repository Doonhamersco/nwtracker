import { NextRequest, NextResponse } from "next/server";
import { listWeightReadings, createWeightReading } from "@/lib/services/weight";
import { createWeightSchema } from "@/lib/validators/weight";

export async function GET() {
  try {
    const readings = listWeightReadings();
    return NextResponse.json(readings);
  } catch (err) {
    console.error("[GET /api/weight]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to list weight readings", detail: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createWeightSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const reading = createWeightReading(parsed.data.date, parsed.data.weightKg);
    return NextResponse.json(reading, { status: 201 });
  } catch (err) {
    console.error("[POST /api/weight]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create weight reading", detail: message }, { status: 500 });
  }
}
