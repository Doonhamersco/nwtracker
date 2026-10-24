import { describe, expect, it } from "vitest";
import { addDays, daysUntil, londonToday, weekStart } from "@/lib/training/dates";
import { buildTrainingPayload } from "@/lib/training/payload";

describe("London training dates", () => {
  it("keeps late evening BST on the London calendar day", () => {
    expect(londonToday(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-24");
    expect(londonToday(new Date("2026-10-24T23:30:00Z"))).toBe("2026-10-25");
  });

  it("starts the week on Monday", () => {
    expect(weekStart("2026-10-24")).toBe("2026-10-19");
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
  });

  it("counts whole days until the fitness test", () => {
    expect(daysUntil("2026-10-24", "2026-11-24")).toBe(31);
    expect(daysUntil("2026-11-24", "2026-11-24")).toBe(0);
    expect(daysUntil("2026-11-25", "2026-11-24")).toBe(-1);
    expect(addDays("2026-10-24", 31)).toBe("2026-11-24");
  });
});

describe("buildTrainingPayload", () => {
  it("counts down in London even when Strava is not configured", async () => {
    const payload = await buildTrainingPayload({
      now: new Date("2026-10-24T12:00:00Z"),
      loadStrava: async () => ({ configured: false }),
      loadHevy: async () => ({ available: false, reason: "unconfigured" }),
    });

    expect(payload.countdownDays).toBe(31);
    expect(payload.testDate).toBe("2026-11-24");
    expect(payload.strava).toEqual({ configured: false });
    expect(payload.hevy).toEqual({ available: false, reason: "unconfigured" });
  });

  it("turns a thrown Strava load into a configured error and still returns Hevy", async () => {
    const payload = await buildTrainingPayload({
      now: new Date("2026-10-24T23:30:00Z"),
      loadStrava: async () => {
        throw new Error("network");
      },
      loadHevy: async () => ({
        available: true,
        streakDays: 2,
        streakCapped: false,
        weeklyVolumeKg: 1000,
        workoutsThisWeek: 1,
      }),
    });

    expect(payload.countdownDays).toBe(30);
    expect(payload.strava).toEqual({
      configured: true,
      error: "Could not load runs from Strava.",
    });
    expect(payload.hevy.available).toBe(true);
  });
});
