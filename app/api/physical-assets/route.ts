import { NextRequest, NextResponse } from "next/server";
import {
  createPhysicalAsset,
  listPhysicalAssets,
  totalPhysicalAssetsGbp,
} from "@/lib/services/physical-assets";
import { createPhysicalAssetSchema } from "@/lib/validators/physical-assets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const assets = listPhysicalAssets();
    return NextResponse.json({ assets, totalGbp: totalPhysicalAssetsGbp() });
  } catch (err) {
    console.error("[GET /api/physical-assets]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to list assets", detail: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createPhysicalAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const asset = createPhysicalAsset(parsed.data);
    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    console.error("[POST /api/physical-assets]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create asset", detail: message }, { status: 500 });
  }
}
