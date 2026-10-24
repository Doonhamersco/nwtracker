import { describe, expect, it } from "vitest";
import { previewSpendingReport } from "@/lib/spending/preview";

describe("previewSpendingReport", () => {
  it("builds a multi-month sample with spend, income, and recurring rows", () => {
    const report = previewSpendingReport();
    expect(report.month).toBe("2026-10");
    expect(report.trend.length).toBe(3);
    expect(report.totals.spend).toBeGreaterThan(0);
    expect(report.totals.income).toBeGreaterThan(report.totals.spend);
    expect(report.byCategory.some((row) => row.previousSpend > 0)).toBe(true);
    expect(report.recurring.map((row) => row.merchant)).toEqual(
      expect.arrayContaining(["Lumen Stream", "Atlas Gym"])
    );
    expect(report.duplicateSubscriptions).toHaveLength(1);
    expect(report.transactions.some((row) => row.isTransfer)).toBe(true);
  });

  it("selects an earlier sample month when asked", () => {
    const report = previewSpendingReport("2026-08");
    expect(report.month).toBe("2026-08");
    expect(report.transactions.every((row) => row.statementMonth === "2026-08")).toBe(true);
  });
});
