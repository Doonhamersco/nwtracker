import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetAllTables } from "./helpers/test-db";
import { randomUUID } from "crypto";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const clientModule = await import("@/db/client");
const { db } = clientModule;
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

const { getPlan, updateCareerPlan, getPlanActuals } = await import(
  "@/lib/services/career-plan"
);
const { createAccount } = await import("@/lib/services/accounts");
import { snapshots, accountValuations } from "@/db/schema";

beforeEach(() => {
  resetAllTables(sqlite);
});

describe("getPlan", () => {
  it("seeds default Police Scotland assumptions on first read", () => {
    const plan = getPlan();
    expect(plan.assumptions.startDate).toBe("2026-10-01");
    expect(plan.assumptions.dateOfBirth).toBe("2005-01-01");
    expect(plan.assumptions.isaMonthlyGbp).toBe(300);
    expect(plan.assumptions.policeContributionRate).toBe(0.1344);
    expect(plan.projection.milestones.length).toBeGreaterThan(0);
  });

  it("persists assumption edits", () => {
    updateCareerPlan({ isaMonthlyGbp: 500, expectedRealReturn: 0.06 });
    const plan = getPlan();
    expect(plan.assumptions.isaMonthlyGbp).toBe(500);
    expect(plan.assumptions.expectedRealReturn).toBe(0.06);
  });
});

describe("getPlanActuals", () => {
  it("sums ISA category balances and SIPP-tagged accounts", () => {
    const isa = createAccount({
      name: "S&S ISA",
      type: "ASSET",
      category: "ISA",
      wrapper: "STOCKS_ISA",
    });
    const sipp = createAccount({
      name: "SIPP",
      type: "ASSET",
      category: "STOCKS",
      wrapper: "SIPP",
    });

    const snapId = randomUUID();
    db.insert(snapshots)
      .values({
        id: snapId,
        takenAt: "2026-09-01T00:00:00.000Z",
        netWorthGbp: 12_000,
        isPartial: false,
      })
      .run();
    db.insert(accountValuations)
      .values({
        id: randomUUID(),
        snapshotId: snapId,
        accountId: isa.id,
        valueNative: 8000,
        valueGbp: 8000,
        isCarriedForward: false,
      })
      .run();
    db.insert(accountValuations)
      .values({
        id: randomUUID(),
        snapshotId: snapId,
        accountId: sipp.id,
        valueNative: 4000,
        valueGbp: 4000,
        isCarriedForward: false,
      })
      .run();

    const actuals = getPlanActuals();
    expect(actuals.isaGbp).toBe(8000);
    expect(actuals.sippGbp).toBe(4000);
    expect(actuals.isaHistory).toHaveLength(1);
  });
});
