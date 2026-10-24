import { describe, expect, it } from "vitest";
import { previewTrainingConnected, previewTrainingUnconfigured } from "@/lib/strava/preview";
import { fitnessSummaryLine } from "@/lib/training/summary";

describe("fitnessSummaryLine", () => {
  it("joins the countdown, weekly distance, and strength sessions", () => {
    expect(fitnessSummaryLine(previewTrainingConnected())).toBe(
      "31 days to test · 18.6 km this week · 4 strength sessions",
    );
  });

  it("omits distance when Strava is not connected", () => {
    expect(fitnessSummaryLine(previewTrainingUnconfigured())).toBe(
      "31 days to test · 4 strength sessions",
    );
  });

  it("uses the singular session label", () => {
    const data = previewTrainingConnected();
    if (!data.hevy.available) throw new Error("preview hevy should be available");
    expect(
      fitnessSummaryLine({
        ...data,
        hevy: { ...data.hevy, workoutsThisWeek: 1 },
      }),
    ).toBe("31 days to test · 18.6 km this week · 1 strength session");
  });

  it("falls back when nothing is configured and the test date has passed", () => {
    expect(
      fitnessSummaryLine({
        countdownDays: -3,
        strava: { configured: false },
        hevy: { available: false, reason: "unconfigured" },
      }),
    ).toBe("Cardio, strength, and weight");
  });
});
