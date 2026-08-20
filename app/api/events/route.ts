import { NextRequest, NextResponse } from "next/server";
import { listEvents, createEvent } from "@/lib/services/events";
import { createEventSchema } from "@/lib/validators/events";

export async function GET() {
  try {
    const events = listEvents();
    return NextResponse.json(events);
  } catch (err) {
    console.error("[GET /api/events]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to list events", detail: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const event = createEvent(parsed.data);
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    console.error("[POST /api/events]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create event", detail: message }, { status: 500 });
  }
}
