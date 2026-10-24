import { describe, expect, it } from "vitest";
import {
  buildDashboardSeries,
  checkinDueLabel,
  displayedAssetsGbp,
  levelStat,
  rollingChange,
  worthOf,
  type SeriesPoint,
} from "@/lib/dashboard-kpis";

function point(
  id: string,
  takenAt: string,
  netWorthGbp: number,
  assetsGbp: number,
  debtGbp: number
): SeriesPoint {
  return {
    snapshotId: id,
    takenAt,
    isoDate: takenAt.slice(0, 10),
    netWorthGbp,
    assetsGbp,
    debtGbp,
  };
}

describe("buildDashboardSeries", () => {
  const accounts = [
    { id: "isa", name: "ISA", type: "ASSET" as const },
    { id: "loan", name: "Loan", type: "LIABILITY" as const },
  ];

  it("treats a falling liability as a positive net-worth contribution", () => {
    const series = buildDashboardSeries({
      snapshots: [
        { id: "a", takenAt: "2026-01-02 12:00:00", netWorthGbp: 1000, isPartial: false },
        { id: "b", takenAt: "2026-02-02 12:00:00", netWorthGbp: 1800, isPartial: false },
      ],
      valuations: [
        { snapshotId: "a", accountId: "isa", valueGbp: 5000 },
        { snapshotId: "a", accountId: "loan", valueGbp: 4000 },
        { snapshotId: "b", accountId: "isa", valueGbp: 5400 },
        { snapshotId: "b", accountId: "loan", valueGbp: 3600 },
      ],
      accounts,
    });

    expect(series.points).toHaveLength(2);
    expect(series.points[1]?.assetsGbp).toBe(5400);
    expect(series.points[1]?.debtGbp).toBe(3600);
    expect(series.movesByDate["2026-02-02"]).toEqual([
      { name: "ISA", deltaGbp: 400, type: "ASSET" },
      { name: "Loan", deltaGbp: 400, type: "LIABILITY" },
    ]);
  });

  it("skips partial snapshots and caps the move list", () => {
    const extraAccounts = Array.from({ length: 14 }, (_, index) => ({
      id: `a${index}`,
      name: `Account ${index}`,
      type: "ASSET" as const,
    }));
    const series = buildDashboardSeries({
      snapshots: [
        { id: "a", takenAt: "2026-01-02 12:00:00", netWorthGbp: 1, isPartial: false },
        { id: "partial", takenAt: "2026-01-15 12:00:00", netWorthGbp: 2, isPartial: true },
        { id: "b", takenAt: "2026-02-02 12:00:00", netWorthGbp: 3, isPartial: false },
      ],
      valuations: [
        ...extraAccounts.map((account) => ({
          snapshotId: "a",
          accountId: account.id,
          valueGbp: 100,
        })),
        ...extraAccounts.map((account, index) => ({
          snapshotId: "b",
          accountId: account.id,
          valueGbp: 100 + (index + 1) * 10,
        })),
      ],
      accounts: extraAccounts,
    });

    expect(series.points.map((item) => item.snapshotId)).toEqual(["a", "b"]);
    expect(series.movesByDate["2026-02-02"]).toHaveLength(12);
  });

  it("keeps physical assets beside account assets and uses today's total on the latest point", () => {
    const series = buildDashboardSeries({
      snapshots: [
        {
          id: "a",
          takenAt: "2026-01-02 12:00:00",
          netWorthGbp: 8000,
          physicalAssetsGbp: null,
          isPartial: false,
        },
        {
          id: "b",
          takenAt: "2026-02-02 12:00:00",
          netWorthGbp: 10000,
          physicalAssetsGbp: 1000,
          isPartial: false,
        },
      ],
      valuations: [
        { snapshotId: "a", accountId: "isa", valueGbp: 9000 },
        { snapshotId: "a", accountId: "loan", valueGbp: 1000 },
        { snapshotId: "b", accountId: "isa", valueGbp: 10000 },
        { snapshotId: "b", accountId: "loan", valueGbp: 1500 },
      ],
      accounts,
      currentPhysicalAssetsGbp: 1500,
    });

    const older = series.points[0];
    const latest = series.points[1];
    expect(older?.physicalAssetsGbp).toBe(0);
    expect(older?.assetsGbp).toBe(9000);
    expect(latest?.assetsGbp).toBe(10000);
    expect(latest?.physicalAssetsGbp).toBe(1500);
    expect(latest?.netWorthGbp).toBe(10000);

    const accountAssets = latest?.assetsGbp ?? 0;
    const physical = latest?.physicalAssetsGbp ?? 0;
    expect(displayedAssetsGbp(latest!, false)).toBe(accountAssets + physical);
    expect(worthOf(latest!, false, false)).toBe(10000);
    expect(worthOf(latest!, false, false)! - worthOf(latest!, false, true)!).toBe(physical);

    expect(displayedAssetsGbp(latest!, true)).toBe(accountAssets);
    expect(worthOf(latest!, false, true)).toBe(8500);
    expect(worthOf(latest!, true, true)).toBe(10000);
    expect(worthOf(latest!, true, false)).toBe(11500);
  });
});

describe("rollingChange", () => {
  const points = [
    point("m0", "2025-01-02 12:00:00", 10000, 14000, 4000),
    point("m1", "2025-02-02 12:00:00", 11000, 14800, 3800),
    point("m11", "2025-12-02 12:00:00", 18000, 21000, 3000),
    point("m12", "2026-01-02 12:00:00", 20000, 22800, 2800),
    point("m13", "2026-02-02 12:00:00", 21500, 24000, 2500),
  ];

  it("measures the latest month against the closest monthly snapshot", () => {
    const stat = rollingChange(points, false, 30, 21);
    expect(stat.delta).toBe(1500);
    expect(stat.percent).toBeCloseTo(7.5, 1);
    expect(stat.spark.length).toBeGreaterThan(0);
  });

  it("returns no year change when history is shorter than the tolerance", () => {
    const short = points.slice(3);
    const stat = rollingChange(short, false, 365, 46);
    expect(stat.delta).toBeNull();
    expect(stat.percent).toBeNull();
  });

  it("measures a year when a snapshot sits near 365 days earlier", () => {
    const stat = rollingChange(points, false, 365, 46);
    expect(stat.delta).toBe(10500);
    expect(stat.percent).toBeCloseTo(95.45, 1);
  });

  it("adds debt back when debt is hidden", () => {
    const latest = points[points.length - 1];
    expect(worthOf(latest, false)).toBe(21500);
    expect(worthOf(latest, true)).toBe(24000);
    const stat = rollingChange(points, true, 30, 21);
    expect(stat.delta).toBe(1200);
  });
});

describe("levelStat", () => {
  it("compares the last two known levels and skips gaps", () => {
    const stat = levelStat([100, null, 140]);
    expect(stat.latest).toBe(140);
    expect(stat.delta).toBe(40);
    expect(stat.percent).toBeCloseTo(40, 5);
    expect(stat.spark).toEqual([100, 140]);
  });
});

describe("checkinDueLabel", () => {
  const now = new Date("2026-10-24T12:00:00");

  it("counts whole days until a month after the last check-in", () => {
    expect(checkinDueLabel("2026-10-02 12:00:00", now)).toBe("due in 9 days");
  });

  it("marks a missed month as overdue", () => {
    expect(checkinDueLabel("2026-09-01 12:00:00", now)).toBe("23 days overdue");
  });

  it("asks for a first check-in when there is no snapshot", () => {
    expect(checkinDueLabel(null, now)).toBe("due now");
  });
});
