import { describe, expect, it } from "vitest";
import { buildDashboardSeries, worthOf } from "@/lib/dashboard-kpis";
import { displayedSnapshotWorth, withCurrentPhysicalAssets } from "@/lib/engine/net-worth";
import { presentSnapshot, snapshotHref, snapshotViewFromQuery } from "@/lib/snapshots/display";

const chase = 3635;
const isa = 1043;
const loan = 10800;
const storedPhysical = 0;

describe("snapshot page matches the overview chart", () => {
  const snapshot = {
    id: "snap-27-nov",
    takenAt: "2026-11-27T12:00:00.000Z",
    netWorthGbp: chase + isa - loan + storedPhysical,
    physicalAssetsGbp: storedPhysical,
    isPartial: false,
  };
  const valuations = [
    { snapshotId: snapshot.id, accountId: "chase", valueGbp: chase },
    { snapshotId: snapshot.id, accountId: "hl", valueGbp: isa },
    { snapshotId: snapshot.id, accountId: "loan", valueGbp: loan },
  ];
  const accounts = [
    { id: "chase", name: "Chase", type: "ASSET" as const },
    { id: "hl", name: "Hargreaves and Lansdown", type: "ASSET" as const },
    { id: "loan", name: "Student Loan", type: "LIABILITY" as const },
  ];

  function chartWorth(hideDebt: boolean, hideAssets = false, currentPhysical = storedPhysical) {
    const [prepared] = withCurrentPhysicalAssets([snapshot], currentPhysical);
    const fromChart = displayedSnapshotWorth(prepared, {
      hideDebt,
      hideAssets,
      debtGbp: loan,
      latestCommittedId: snapshot.id,
      currentPhysicalAssetsGbp: currentPhysical,
    });
    const series = buildDashboardSeries({
      snapshots: [prepared],
      valuations,
      accounts,
      currentPhysicalAssetsGbp: currentPhysical,
    });
    expect(worthOf(series.points[0], hideDebt, hideAssets)).toBe(fromChart);
    return fromChart;
  }

  function page(hideDebt: boolean, hideAssets = false, currentPhysical = storedPhysical) {
    return presentSnapshot({
      snapshot,
      accounts: [
        { id: "chase", name: "Chase", category: "CASH", type: "ASSET", valueGbp: chase },
        {
          id: "hl",
          name: "Hargreaves and Lansdown",
          category: "ISA",
          type: "ASSET",
          valueGbp: isa,
        },
        {
          id: "loan",
          name: "Student Loan",
          category: "STUDENT_LOAN",
          type: "LIABILITY",
          valueGbp: loan,
        },
      ],
      isLatestCommitted: true,
      currentPhysicalAssetsGbp: currentPhysical,
      hideDebt,
      hideAssets,
    });
  }

  it("equals the chart value in liquid mode and lists only assets", () => {
    const view = page(true);
    expect(view.totalGbp).toBe(chartWorth(true));
    expect(view.totalGbp).toBe(chase + isa);
    expect(view.lines.map((line) => line.name)).toEqual(["Chase", "Hargreaves and Lansdown"]);
    expect(view.lines.reduce((sum, line) => sum + line.signedGbp, 0)).toBe(view.totalGbp);
    expect(view.label).toBe("Liquid net worth");
  });

  it("equals the chart value in total mode and subtracts the student loan", () => {
    const view = page(false);
    expect(view.totalGbp).toBe(chartWorth(false));
    expect(view.totalGbp).toBe(chase + isa - loan);
    const loanLine = view.lines.find((line) => line.name === "Student Loan");
    expect(loanLine?.signedGbp).toBe(-loan);
    expect(view.lines.reduce((sum, line) => sum + line.signedGbp, 0)).toBe(view.totalGbp);
    expect(view.label).toBe("Net worth");
  });

  it("still matches the chart when today's physical assets differ from the stored amount", () => {
    const currentPhysical = 500;
    expect(page(true, false, currentPhysical).totalGbp).toBe(chartWorth(true, false, currentPhysical));
    expect(page(false, false, currentPhysical).totalGbp).toBe(chartWorth(false, false, currentPhysical));
    expect(page(true, false, currentPhysical).totalGbp).toBe(chase + isa + currentPhysical);
    expect(page(false, false, currentPhysical).totalGbp).toBe(chase + isa - loan + currentPhysical);
  });

  it("passes the overview mode through the snapshot link", () => {
    expect(snapshotHref("snap-27-nov", true, false)).toBe("/snapshots/snap-27-nov?mode=liquid");
    expect(snapshotHref("snap-27-nov", false, true)).toBe(
      "/snapshots/snap-27-nov?mode=total&assets=hidden"
    );
    expect(snapshotViewFromQuery({ mode: "liquid" })).toEqual({ hideDebt: true, hideAssets: null });
    expect(snapshotViewFromQuery({})).toEqual({ hideDebt: null, hideAssets: null });
  });
});
