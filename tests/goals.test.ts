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

beforeEach(() => {
  resetAllTables(sqlite);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function insertSnapshot(netWorthGbp: number, takenAt: string, isPartial = false) {
  const id = randomUUID();
  db.insert(snapshots).values({ id, takenAt, netWorthGbp, isPartial }).run();
  return id;
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
      baselineValue: 0,
      baselineDate: null,
      isActive: true,
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
      baselineValue: 0,
      baselineDate: null,
      isActive: true,
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
      baselineValue: null,
      baselineDate: null,
      isActive: true,
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
      baselineValue: null,
      baselineDate: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const progress = computeGoalProgress(goalRow, 50000, []);
    expect(progress.progressPercent).toBeNull();
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

  it("throws if goal not found", () => {
    expect(() =>
      updateGoal("00000000-0000-0000-0000-000000000000", { name: "Ghost" })
    ).toThrow("not found");
  });
});

// ─── deleteGoal ───────────────────────────────────────────────────────────────

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
