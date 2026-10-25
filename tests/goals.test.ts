import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

const {
  createGoal,
  updateGoal,
  deleteGoal,
  listGoals,
  getGoalById,
  computeGoalProgress,
} = await import("@/lib/services/goals");

import {
  goals,
  snapshots,
  accountValuations,
  accounts,
  lifeMetricDefinitions,
  lifeMetricReadings,
} from "@/db/schema";
import { createGoalSchema } from "@/lib/validators/goals";
import { goalDateCaption } from "@/lib/goals/progress";
import { GoalForm, METRIC_TYPE_OPTIONS } from "@/components/goals/GoalForm";
import type { GoalRow } from "@/lib/services/goals";

beforeEach(() => {
  resetAllTables(sqlite);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function insertSnapshot(netWorthGbp: number, takenAt: string, isPartial = false) {
  const id = randomUUID();
  db.insert(snapshots).values({ id, takenAt, netWorthGbp, isPartial }).run();
  return id;
}

function insertAccount(
  name: string,
  type: "ASSET" | "LIABILITY",
  category: "CASH" | "STUDENT_LOAN" | "OTHER_LIABILITY" = type === "LIABILITY" ? "OTHER_LIABILITY" : "CASH"
) {
  const id = randomUUID();
  db.insert(accounts).values({ id, name, type, category, currencyCode: "GBP" }).run();
  return id;
}

function insertValuation(snapshotId: string, accountId: string, valueGbp: number) {
  db.insert(accountValuations).values({
    id: randomUUID(),
    snapshotId,
    accountId,
    valueNative: valueGbp,
    valueGbp,
  }).run();
}

function fakeGoal(overrides: Partial<GoalRow> = {}): GoalRow {
  return {
    id: randomUUID(),
    name: "Goal",
    description: null,
    targetValue: 10000,
    targetDate: "2030-01-01",
    metricType: "NET_WORTH",
    direction: "increase",
    linkedMetricId: null,
    linkedCategory: null,
    linkedAccountId: null,
    baselineValue: null,
    baselineDate: null,
    isActive: true,
    completedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── createGoal ───────────────────────────────────────────────────────────────

describe("createGoal", () => {
  it("inserts a goal correctly", () => {
    const goal = createGoal({
      name: "Reach £100k",
      targetValue: 100000,
      targetDate: "2027-01-01",
      metricType: "NET_WORTH",
    });

    expect(goal.id).toBeDefined();
    expect(goal.name).toBe("Reach £100k");
    expect(goal.targetValue).toBe(100000);
    expect(goal.targetDate).toBe("2027-01-01");
    expect(goal.metricType).toBe("NET_WORTH");
    expect(goal.isActive).toBe(true);
  });

  it("auto-sets baselineValue from the latest committed snapshot", () => {
    insertSnapshot(50000, "2024-01-01T00:00:00.000Z", false);
    insertSnapshot(60000, "2024-06-01T00:00:00.000Z", false);

    const goal = createGoal({
      name: "Net Worth Goal",
      targetValue: 200000,
      targetDate: "2030-01-01",
      metricType: "NET_WORTH",
    });

    expect(goal.baselineValue).toBe(60000);
  });

  it("does not override explicitly provided baseline", () => {
    insertSnapshot(50000, "2024-01-01T00:00:00.000Z", false);

    const goal = createGoal({
      name: "Manual Baseline Goal",
      targetValue: 200000,
      targetDate: "2030-01-01",
      metricType: "NET_WORTH",
      baselineValue: 12345,
    });

    expect(goal.baselineValue).toBe(12345);
  });
});

// ─── listGoals ────────────────────────────────────────────────────────────────

describe("listGoals", () => {
  it("returns active goals with progress computed", () => {
    insertSnapshot(30000, "2024-01-01T00:00:00.000Z", false);
    insertSnapshot(40000, "2024-06-01T00:00:00.000Z", false);

    createGoal({
      name: "Test Goal",
      targetValue: 100000,
      targetDate: "2030-01-01",
      metricType: "NET_WORTH",
      baselineValue: 20000,
    });

    const result = listGoals();
    expect(result.length).toBeGreaterThanOrEqual(1);

    const item = result.find((g) => g.goal.name === "Test Goal");
    expect(item).toBeDefined();
    expect(item!.progress).toBeDefined();
    expect(item!.progress.currentValue).toBe(40000);
    expect(item!.files).toEqual([]);
  });

  it("treats a manually completed goal as achieved without snapshot data", () => {
    const goal = createGoal({
      name: "Join the police",
      targetValue: 1,
      targetDate: "2026-08-31",
      metricType: "NET_WORTH",
    });
    updateGoal(goal.id, { completedAt: "2026-08-20", description: "Offer accepted." });

    const item = listGoals().find((g) => g.goal.id === goal.id);
    expect(item).toBeDefined();
    expect(item!.progress.status).toBe("achieved");
    expect(item!.progress.progressPercent).toBe(100);
    expect(item!.goal.completedAt).toBe("2026-08-20");
  });

  it("does not return inactive goals", () => {
    const goal = createGoal({
      name: "Inactive Goal",
      targetValue: 100000,
      targetDate: "2030-01-01",
      metricType: "NET_WORTH",
    });
    updateGoal(goal.id, { isActive: false });

    const result = listGoals();
    expect(result.find((g) => g.goal.name === "Inactive Goal")).toBeUndefined();
  });
});

// ─── computeGoalProgress ─────────────────────────────────────────────────────

describe("computeGoalProgress", () => {
  it("status = 'achieved' when currentValue >= targetValue", () => {
    const goalRow = {
      id: randomUUID(),
      name: "Achieved",
      description: null,
      targetValue: 10000,
      targetDate: "2025-01-01",
      metricType: "NET_WORTH" as const,
      linkedMetricId: null,
      linkedCategory: null,
      linkedAccountId: null,
      direction: "increase" as const,
      baselineValue: 0,
      baselineDate: null,
      isActive: true,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };

    const progress = computeGoalProgress(goalRow, 15000, [
      { timestamp: Date.now() - 100000, value: 8000 },
      { timestamp: Date.now(), value: 15000 },
    ]);

    expect(progress.status).toBe("achieved");
    expect(progress.currentValue).toBe(15000);
  });

  it("calculates progressPercent correctly", () => {
    const goalRow = {
      id: randomUUID(),
      name: "Progress Test",
      description: null,
      targetValue: 100,
      targetDate: "2030-01-01",
      metricType: "NET_WORTH" as const,
      linkedMetricId: null,
      linkedCategory: null,
      linkedAccountId: null,
      direction: "increase" as const,
      baselineValue: 0,
      baselineDate: null,
      isActive: true,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };

    const progress = computeGoalProgress(goalRow, 50, []);
    // (50 - 0) / (100 - 0) * 100 = 50%
    expect(progress.progressPercent).toBeCloseTo(50);
  });

  it("status = 'no_data' when fewer than 2 data points and not yet achieved", () => {
    const goalRow = {
      id: randomUUID(),
      name: "No Data",
      description: null,
      targetValue: 100000,
      targetDate: "2030-01-01",
      metricType: "NET_WORTH" as const,
      linkedMetricId: null,
      linkedCategory: null,
      linkedAccountId: null,
      direction: "increase" as const,
      baselineValue: null,
      baselineDate: null,
      isActive: true,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };

    const progress = computeGoalProgress(goalRow, 5000, [
      { timestamp: Date.now(), value: 5000 },
    ]);

    expect(progress.status).toBe("no_data");
    expect(progress.isOnTrack).toBeNull();
  });

  it("progressPercent = null when baselineValue is null", () => {
    const goalRow = {
      id: randomUUID(),
      name: "Null Baseline",
      description: null,
      targetValue: 100000,
      targetDate: "2030-01-01",
      metricType: "NET_WORTH" as const,
      linkedMetricId: null,
      linkedCategory: null,
      linkedAccountId: null,
      direction: "increase" as const,
      baselineValue: null,
      baselineDate: null,
      isActive: true,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };

    const progress = computeGoalProgress(goalRow, 50000, []);
    expect(progress.progressPercent).toBeNull();
  });

  it("status = 'achieved' when completedAt is set even if current is below target", () => {
    const goalRow = {
      id: randomUUID(),
      name: "Manually completed",
      description: "I did it",
      targetValue: 90,
      targetDate: "2027-01-01",
      metricType: "NET_WORTH" as const,
      linkedMetricId: null,
      linkedCategory: null,
      linkedAccountId: null,
      direction: "increase" as const,
      baselineValue: 0,
      baselineDate: null,
      isActive: true,
      completedAt: "2026-08-20",
      createdAt: new Date().toISOString(),
    };

    const progress = computeGoalProgress(goalRow, 0, []);
    expect(progress.status).toBe("achieved");
    expect(progress.progressPercent).toBe(100);
    expect(progress.currentValue).toBe(90);
  });

  it("does not treat a debt balance above the target as achieved", () => {
    const progress = computeGoalProgress(
      fakeGoal({
        name: "Student Loan paid off",
        metricType: "DEBT_PAYOFF",
        direction: "decrease",
        targetValue: 0,
        baselineValue: 10770,
      }),
      11709,
      [
        { timestamp: Date.now() - 100000, value: 10770 },
        { timestamp: Date.now(), value: 11709 },
      ]
    );

    expect(progress.status).not.toBe("achieved");
    expect(progress.currentValue).toBe(11709);
    expect(progress.targetValue).toBe(0);
    expect(progress.progressPercent).toBeCloseTo(((10770 - 11709) / 10770) * 100);
  });

  it("measures payoff progress from the starting debt down to the target", () => {
    const progress = computeGoalProgress(
      fakeGoal({
        metricType: "DEBT_PAYOFF",
        direction: "decrease",
        targetValue: 0,
        baselineValue: 10770,
      }),
      5385,
      []
    );

    expect(progress.progressPercent).toBeCloseTo(50);
    expect(progress.status).toBe("no_data");
  });

  it("completes a debt goal only when the balance is at or below the target", () => {
    const open = computeGoalProgress(
      fakeGoal({
        metricType: "DEBT_PAYOFF",
        direction: "decrease",
        targetValue: 500,
        baselineValue: 10770,
      }),
      501,
      []
    );
    const done = computeGoalProgress(
      fakeGoal({
        metricType: "DEBT_PAYOFF",
        direction: "decrease",
        targetValue: 500,
        baselineValue: 10770,
      }),
      500,
      []
    );

    expect(open.status).not.toBe("achieved");
    expect(done.status).toBe("achieved");
    expect(done.currentValue).toBe(500);
  });

  it("uses the earliest snapshot as the starting balance when none was stored", () => {
    const progress = computeGoalProgress(
      fakeGoal({
        metricType: "DEBT_PAYOFF",
        direction: "decrease",
        targetValue: 0,
        baselineValue: null,
      }),
      4000,
      [
        { timestamp: Date.now() - 200000, value: 10000 },
        { timestamp: Date.now(), value: 4000 },
      ]
    );

    expect(progress.baselineValue).toBe(10000);
    expect(progress.progressPercent).toBeCloseTo(60);
    expect(progress.status).not.toBe("achieved");
  });

  it("supports a reduce-to target on an upward metric", () => {
    const progress = computeGoalProgress(
      fakeGoal({
        metricType: "ACCOUNT_CATEGORY",
        direction: "decrease",
        targetValue: 2000,
        baselineValue: 10000,
      }),
      6000,
      [
        { timestamp: Date.now() - 100000, value: 10000 },
        { timestamp: Date.now(), value: 6000 },
      ]
    );

    expect(progress.status).not.toBe("achieved");
    expect(progress.progressPercent).toBeCloseTo(50);
  });

  it("keeps the real balance when a decrease goal is marked complete", () => {
    const progress = computeGoalProgress(
      fakeGoal({
        metricType: "DEBT_PAYOFF",
        direction: "decrease",
        targetValue: 5000,
        baselineValue: 10000,
        completedAt: "2026-08-20",
      }),
      2000,
      []
    );

    expect(progress.status).toBe("achieved");
    expect(progress.currentValue).toBe(2000);
  });
});

// ─── updateGoal ───────────────────────────────────────────────────────────────

describe("updateGoal", () => {
  it("changes only mutable fields", () => {
    const goal = createGoal({
      name: "Original Name",
      targetValue: 50000,
      targetDate: "2027-01-01",
      metricType: "NET_WORTH",
    });

    const updated = updateGoal(goal.id, {
      name: "Updated Name",
      targetValue: 75000,
      targetDate: "2028-01-01",
    });

    expect(updated.name).toBe("Updated Name");
    expect(updated.targetValue).toBe(75000);
    expect(updated.targetDate).toBe("2028-01-01");
    expect(updated.metricType).toBe("NET_WORTH");
  });

  it("marks a goal complete via completedAt", () => {
    const goal = createGoal({
      name: "Finish this",
      targetValue: 1,
      targetDate: "2027-01-01",
      metricType: "NET_WORTH",
    });

    const updated = updateGoal(goal.id, {
      description: "Done — attached evidence.",
      completedAt: "2026-08-20",
    });

    expect(updated.completedAt).toBe("2026-08-20");
    expect(updated.description).toBe("Done — attached evidence.");
  });

  it("clears completion when completedAt is null", () => {
    const goal = createGoal({
      name: "Reopen me",
      targetValue: 1,
      targetDate: "2027-01-01",
      metricType: "NET_WORTH",
      completedAt: "2026-01-01",
    });

    const updated = updateGoal(goal.id, { completedAt: null });
    expect(updated.completedAt).toBeNull();
  });

  it("throws if goal not found", () => {
    expect(() =>
      updateGoal("00000000-0000-0000-0000-000000000000", { name: "Ghost" })
    ).toThrow("not found");
  });
});

// ─── deleteGoal ───────────────────────────────────────────────────────────────

describe("debt payoff goals", () => {
  it("accepts a £0 target and stores the current debt as the baseline", () => {
    const early = insertSnapshot(10000, "2024-01-01T00:00:00.000Z");
    const latest = insertSnapshot(11709, "2026-09-01T00:00:00.000Z");
    const loan = insertAccount("Student Loans Company", "LIABILITY", "STUDENT_LOAN");
    const cash = insertAccount("Current", "ASSET", "CASH");
    const card = insertAccount("Credit card", "LIABILITY", "OTHER_LIABILITY");
    insertValuation(early, loan, 12000);
    insertValuation(early, cash, 22000);
    insertValuation(latest, loan, 9000);
    insertValuation(latest, cash, 22709);
    insertValuation(latest, card, 2000);

    const parsed = createGoalSchema.parse({
      name: "Student Loan paid off",
      description: "pay off the remaining £10,770",
      targetValue: 0,
      targetDate: "2030-01-01",
      metricType: "DEBT_PAYOFF",
      linkedAccountId: loan,
    });
    const goal = createGoal(parsed);

    expect(goal.metricType).toBe("DEBT_PAYOFF");
    expect(goal.direction).toBe("decrease");
    expect(goal.targetValue).toBe(0);
    expect(goal.baselineValue).toBe(9000);
    expect(goal.linkedAccountId).toBe(loan);

    const item = listGoals().find((entry) => entry.goal.id === goal.id);
    expect(item!.progress.currentValue).toBe(9000);
    expect(item!.progress.status).not.toBe("achieved");
    expect(item!.progress.progressPercent).toBeCloseTo(0);
  });

  it("reads every liability when no loan account is chosen", () => {
    const snap = insertSnapshot(11709, "2026-09-01T00:00:00.000Z");
    const loan = insertAccount("Student Loans Company", "LIABILITY", "STUDENT_LOAN");
    const card = insertAccount("Credit card", "LIABILITY", "OTHER_LIABILITY");
    insertValuation(snap, loan, 9000);
    insertValuation(snap, card, 2709);

    const goal = createGoal({
      name: "Become debt free",
      targetValue: 0,
      targetDate: "2030-01-01",
      metricType: "DEBT_PAYOFF",
    });

    expect(goal.baselineValue).toBe(11709);
    const item = listGoals().find((entry) => entry.goal.id === goal.id);
    expect(item!.progress.currentValue).toBe(11709);
    expect(item!.progress.status).not.toBe("achieved");
  });

  it("stops treating a net-worth figure above the old target as completion", () => {
    const snap = insertSnapshot(11709, "2026-09-01T00:00:00.000Z");
    const loan = insertAccount("Student Loans Company", "LIABILITY", "STUDENT_LOAN");
    const cash = insertAccount("Current", "ASSET", "CASH");
    insertValuation(snap, loan, 9000);
    insertValuation(snap, cash, 20709);

    const created = createGoal({
      name: "Student Loan paid off",
      description: "pay off the remaining £10,770",
      targetValue: 10770,
      targetDate: "2030-01-01",
      metricType: "NET_WORTH",
    });
    const before = listGoals().find((entry) => entry.goal.id === created.id);
    expect(before!.progress.currentValue).toBe(11709);
    expect(before!.progress.status).toBe("achieved");

    updateGoal(created.id, {
      metricType: "DEBT_PAYOFF",
      targetValue: 0,
      linkedAccountId: loan,
    });

    const after = listGoals().find((entry) => entry.goal.id === created.id);
    expect(after!.goal.direction).toBe("decrease");
    expect(after!.goal.targetValue).toBe(0);
    expect(after!.goal.baselineValue).toBe(9000);
    expect(after!.progress.currentValue).toBe(9000);
    expect(after!.progress.status).not.toBe("achieved");
  });

  it("rejects a £0 target on an increase goal", () => {
    expect(() =>
      createGoalSchema.parse({
        name: "Reach zero",
        targetValue: 0,
        targetDate: "2030-01-01",
        metricType: "NET_WORTH",
      })
    ).toThrow();
  });
});

describe("goal date caption", () => {
  const formatDate = (iso: string) => iso;

  it("says target reached when the goal is achieved without a completion date", () => {
    expect(
      goalDateCaption({
        isCompleted: true,
        completedAt: null,
        projectedCompletionDate: null,
        formatDate,
      })
    ).toBe("Target reached");
  });

  it("keeps insufficient data for an open goal with no projection", () => {
    expect(
      goalDateCaption({
        isCompleted: false,
        completedAt: null,
        projectedCompletionDate: null,
        formatDate,
      })
    ).toBe("Insufficient data");
  });
});

describe("goal form types", () => {
  it("offers pay off debt on create and edit", () => {
    expect(METRIC_TYPE_OPTIONS.map((option) => option.label)).toContain("Pay off debt");

    const createHtml = renderToStaticMarkup(
      createElement(GoalForm, { onSuccess() {}, onCancel() {} })
    );
    expect(createHtml).toContain("Pay off debt");
    expect(createHtml).toContain("Reduce toward target");

    const editHtml = renderToStaticMarkup(
      createElement(GoalForm, {
        onSuccess() {},
        onCancel() {},
        initial: {
          id: "goal-1",
          name: "Student Loan paid off",
          description: "pay off the remaining £10,770",
          targetValue: 0,
          targetDate: "2030-01-01",
          metricType: "DEBT_PAYOFF",
          direction: "decrease",
          linkedCategory: null,
          linkedAccountId: null,
          linkedMetricId: null,
          completedAt: null,
          files: [],
        },
      })
    );
    expect(editHtml).toContain("Pay off debt");
    expect(editHtml).toContain("All debt");
    expect(editHtml).toContain("Loan account");
    expect(editHtml).toContain('value="0"');
  });
});

describe("deleteGoal", () => {
  it("removes the goal row", () => {
    const goal = createGoal({
      name: "To Delete",
      targetValue: 10000,
      targetDate: "2025-01-01",
      metricType: "NET_WORTH",
    });

    deleteGoal(goal.id);

    const all = db.select().from(goals).all();
    expect(all.find((g) => g.id === goal.id)).toBeUndefined();
  });
});
