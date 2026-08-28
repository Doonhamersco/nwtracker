import { describe, it, expect } from "vitest";
import { metricCategory, partitionMetrics } from "@/lib/metrics-categories";

describe("metricCategory", () => {
  it("treats body weight and Hevy metrics as gym", () => {
    expect(metricCategory({ isHevyMetric: false, name: "Body Weight" })).toBe("gym");
    expect(metricCategory({ isHevyMetric: true, name: "Workout Sessions (30d)" })).toBe("gym");
  });

  it("treats income, spend, and savings as finance", () => {
    expect(metricCategory({ isHevyMetric: false, name: "Monthly Income" })).toBe("finance");
    expect(metricCategory({ isHevyMetric: false, name: "Monthly Spend" })).toBe("finance");
    expect(metricCategory({ isHevyMetric: false, name: "Savings Rate" })).toBe("finance");
  });
});

describe("partitionMetrics", () => {
  it("splits mixed metrics into gym and finance", () => {
    const { gym, finance } = partitionMetrics([
      { id: "1", isHevyMetric: false, name: "Body Weight" },
      { id: "2", isHevyMetric: false, name: "Monthly Income" },
      { id: "3", isHevyMetric: true, name: "Training Volume (30d)" },
    ]);
    expect(gym.map((m) => m.id)).toEqual(["1", "3"]);
    expect(finance.map((m) => m.id)).toEqual(["2"]);
  });
});
