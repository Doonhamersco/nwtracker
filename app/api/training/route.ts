import { NextResponse } from "next/server";
import { hevyClient, hevyIsConfigured } from "@/lib/hevy/client";
import { StravaApiError, stravaGateway } from "@/lib/strava/client";
import { buildTrainingPayload } from "@/lib/training/payload";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildTrainingPayload({
    now: new Date(),
    loadStrava: async () => {
      if (!stravaGateway.isConfigured()) return { configured: false };
      try {
        const summary = await stravaGateway.getSummary();
        return { configured: true, summary };
      } catch (err) {
        const status = err instanceof StravaApiError ? err.status : "unknown";
        console.error("[training] strava status", status);
        const message =
          err instanceof StravaApiError ? err.message : "Could not load runs from Strava.";
        return { configured: true, error: message };
      }
    },
    loadHevy: async () => {
      if (!hevyIsConfigured()) return { available: false, reason: "unconfigured" };
      try {
        const snapshot = await hevyClient.getTrainingSnapshot();
        return { available: true, ...snapshot };
      } catch (err) {
        console.error("[training] hevy", err instanceof Error ? err.name : "error");
        return { available: false, reason: "error" };
      }
    },
  });

  return NextResponse.json(payload);
}
