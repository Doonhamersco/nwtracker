import { describe, expect, it } from "vitest";
import { showChartEvents } from "@/components/dashboard/useDashboardPrefs";

describe("showChartEvents", () => {
  it("shows event markers unless the saved choice is off", () => {
    expect(showChartEvents(null)).toBe(true);
    expect(showChartEvents(undefined)).toBe(true);
    expect(showChartEvents("1")).toBe(true);
    expect(showChartEvents("0")).toBe(false);
  });
});
