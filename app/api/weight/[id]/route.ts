import { NextRequest, NextResponse } from "next/server";
import { deleteWeightReading } from "@/lib/services/weight";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    deleteWeightReading(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/weight/[id]]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to delete weight reading", detail: message }, { status: 500 });
  }
}
