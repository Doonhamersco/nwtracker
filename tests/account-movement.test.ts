import { describe, expect, it } from "vitest";
import { accountMovement } from "@/lib/engine/account-movement";
import { formatSnapshotDayLabel, snapshotAsOfLastMonth } from "@/lib/engine/net-worth";

describe("accountMovement", () => {
  it("keeps the full balance change when no deposit was recorded", () => {
    const movement = accountMovement(1043, 545, null);
    expect(movement.kind).toBe("change");
    expect(movement.amount).toBe(498);
    expect(movement.percent).toBeCloseTo(91.376, 2);
    expect(movement.hint).toBeNull();
  });

  it("subtracts a deposit from the rise and percentages the cost basis", () => {
    const movement = accountMovement(1043, 545, [498]);
    expect(movement.kind).toBe("growth");
    expect(movement.amount).toBe(0);
    expect(movement.percent).toBe(0);
    expect(movement.hint).toBe("excl. £498 deposited");
  });

  it("treats a withdrawal as money taken out", () => {
    const movement = accountMovement(800, 1000, [-150]);
    expect(movement.amount).toBeCloseTo(-50);
    expect(movement.hint).toBe("excl. £150 withdrawn");
    expect(movement.percent).toBeCloseTo(-50 / 850 * 100, 2);
  });

  it("falls back to the full change when any deposit in the span is blank", () => {
    const movement = accountMovement(1200, 800, [100, null]);
    expect(movement.kind).toBe("change");
    expect(movement.amount).toBe(400);
  });
});

describe("month-ago label", () => {
  it("names the snapshot date, including the earliest fallback", () => {
    expect(formatSnapshotDayLabel("2026-10-27T09:00:00.000Z")).toBe("27 Oct");
    const earliest = {
      id: "old",
      takenAt: "2026-08-03 12:00:00",
      netWorthGbp: 1000,
      isPartial: false,
    };
    const latest = {
      id: "new",
      takenAt: "2026-08-20 12:00:00",
      netWorthGbp: 1200,
      isPartial: false,
    };
    const baseline = snapshotAsOfLastMonth([latest, earliest], "2026-08-27");
    expect(baseline?.id).toBe("old");
    expect(formatSnapshotDayLabel(baseline!.takenAt)).toBe("3 Aug");
  });
});
