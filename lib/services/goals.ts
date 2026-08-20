import { randomUUID } from "crypto";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db/client";
import {
  goals,
  snapshots,
  accountValuations,
  lifeMetricReadings,
  accounts,
} from "@/db/schema";
import { projectGoalCompletion } from "@/lib/engine/net-worth";
import type { CreateGoalInput, UpdateGoalInput } from "@/lib/validators/goals";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoalRow = typeof goals.$inferSelect;

export interface GoalProgress {
  currentValue: number;
  baselineValue: number | null;
  targetValue: number;
  progressPercent: number | null;
  isOnTrack: boolean | null;
  projectedCompletionDate: Date | null;
  status: "on_track" | "at_risk" | "achieved" | "no_data";
}

export interface GoalWithProgress {
  goal: GoalRow;
  progress: GoalProgress;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLatestCommittedSnapshot() {
  const [snapshot] = db
    .select()
    .from(snapshots)
    .where(eq(snapshots.isPartial, false))
    .orderBy(desc(snapshots.takenAt))
    .limit(1)
    .all();
  return snapshot ?? null;
}

function getAllCommittedSnapshots() {
  return db
    .select()
    .from(snapshots)
    .where(eq(snapshots.isPartial, false))
    .orderBy(snapshots.takenAt)
    .all();
}

function getCurrentValueForGoal(goal: GoalRow): {
  currentValue: number | null;
  dataPoints: Array<{ timestamp: number; value: number }>;
} {
  const allSnapshots = getAllCommittedSnapshots();

  if (allSnapshots.length === 0) {
    return { currentValue: null, dataPoints: [] };
  }

  if (goal.metricType === "NET_WORTH") {
    const dataPoints = allSnapshots
      .filter((s) => s.netWorthGbp !== null)
      .map((s) => ({
        timestamp: new Date(s.takenAt).getTime(),
        value: s.netWorthGbp!,
      }));

    const lastSnapshot = allSnapshots[allSnapshots.length - 1];
    const currentValue =
      lastSnapshot.netWorthGbp !== null ? lastSnapshot.netWorthGbp : null;

    return { currentValue, dataPoints };
  }

  if (goal.metricType === "LIFE_METRIC" && goal.linkedMetricId) {
    const dataPoints: Array<{ timestamp: number; value: number }> = [];

    for (const snap of allSnapshots) {
      const [reading] = db
        .select()
        .from(lifeMetricReadings)
        .where(
          and(
            eq(lifeMetricReadings.snapshotId, snap.id),
            eq(lifeMetricReadings.metricId, goal.linkedMetricId)
          )
        )
        .limit(1)
        .all();

      if (reading !== undefined) {
        dataPoints.push({
          timestamp: new Date(snap.takenAt).getTime(),
          value: reading.value,
        });
      }
    }

    const currentValue =
      dataPoints.length > 0
        ? dataPoints[dataPoints.length - 1].value
        : null;

    return { currentValue, dataPoints };
  }

  if (goal.metricType === "ACCOUNT_CATEGORY" && goal.linkedCategory) {
    const linkedCategory = goal.linkedCategory;
    const dataPoints: Array<{ timestamp: number; value: number }> = [];

    const categoryAccounts = db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.category, linkedCategory))
      .all();

    const accountIds = new Set(categoryAccounts.map((a) => a.id));

    for (const snap of allSnapshots) {
      const valuations = db
        .select()
        .from(accountValuations)
        .where(eq(accountValuations.snapshotId, snap.id))
        .all();

      const categoryValuations = valuations.filter((v) =>
        accountIds.has(v.accountId)
      );

      if (categoryValuations.length > 0) {
        const total = categoryValuations.reduce(
          (sum, v) => sum + v.valueGbp,
          0
        );
        dataPoints.push({
          timestamp: new Date(snap.takenAt).getTime(),
          value: total,
        });
      }
    }

    const currentValue =
      dataPoints.length > 0
        ? dataPoints[dataPoints.length - 1].value
        : null;

    return { currentValue, dataPoints };
  }

  return { currentValue: null, dataPoints: [] };
}

// ─── Pure computation ─────────────────────────────────────────────────────────

export function computeGoalProgress(
  goal: GoalRow,
  currentValue: number,
  dataPoints: Array<{ timestamp: number; value: number }> = []
): GoalProgress {
  const baseline = goal.baselineValue;
  const target = goal.targetValue;

  let progressPercent: number | null = null;
  if (baseline !== null && baseline !== undefined && target !== baseline) {
    progressPercent = ((currentValue - baseline) / (target - baseline)) * 100;
  }

  if (currentValue >= target) {
    return {
      currentValue,
      baselineValue: baseline ?? null,
      targetValue: target,
      progressPercent,
      isOnTrack: true,
      projectedCompletionDate: null,
      status: "achieved",
    };
  }

  if (dataPoints.length < 2) {
    return {
      currentValue,
      baselineValue: baseline ?? null,
      targetValue: target,
      progressPercent,
      isOnTrack: null,
      projectedCompletionDate: null,
      status: "no_data",
    };
  }

  const projectedDate = projectGoalCompletion(dataPoints, target);
  const targetDate = new Date(goal.targetDate);
  const isOnTrack =
    projectedDate !== null ? projectedDate <= targetDate : false;
  const status = isOnTrack ? "on_track" : "at_risk";

  return {
    currentValue,
    baselineValue: baseline ?? null,
    targetValue: target,
    progressPercent,
    isOnTrack,
    projectedCompletionDate: projectedDate,
    status,
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export function createGoal(input: CreateGoalInput): GoalRow {
  const id = randomUUID();

  let baselineValue = input.baselineValue ?? null;
  let baselineDate = input.baselineDate ?? null;

  // Auto-set baseline from latest snapshot if not provided
  if (baselineValue === null) {
    const latestSnapshot = getLatestCommittedSnapshot();
    if (latestSnapshot) {
      const { currentValue } = getCurrentValueForGoal({
        id,
        name: input.name,
        description: input.description ?? null,
        targetValue: input.targetValue,
        targetDate: input.targetDate,
        metricType: input.metricType,
        linkedMetricId: input.linkedMetricId ?? null,
        linkedCategory: input.linkedCategory ?? null,
        baselineValue: null,
        baselineDate: null,
        isActive: input.isActive ?? true,
        createdAt: new Date().toISOString(),
      });

      if (currentValue !== null) {
        baselineValue = currentValue;
        baselineDate = latestSnapshot.takenAt.slice(0, 10);
      }
    }
  }

  db.insert(goals)
    .values({
      id,
      name: input.name,
      description: input.description ?? null,
      targetValue: input.targetValue,
      targetDate: input.targetDate,
      metricType: input.metricType,
      linkedMetricId: input.linkedMetricId ?? null,
      linkedCategory: input.linkedCategory ?? null,
      baselineValue,
      baselineDate,
      isActive: input.isActive ?? true,
    })
    .run();

  const [row] = db.select().from(goals).where(eq(goals.id, id)).all();
  return row;
}

export function updateGoal(id: string, input: UpdateGoalInput): GoalRow {
  const existing = db.select().from(goals).where(eq(goals.id, id)).all()[0];
  if (!existing) throw new Error(`Goal not found: ${id}`);

  db.update(goals)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.targetValue !== undefined && { targetValue: input.targetValue }),
      ...(input.targetDate !== undefined && { targetDate: input.targetDate }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    })
    .where(eq(goals.id, id))
    .run();

  const [row] = db.select().from(goals).where(eq(goals.id, id)).all();
  return row;
}

export function deleteGoal(id: string): void {
  db.delete(goals).where(eq(goals.id, id)).run();
}

export function listGoals(): GoalWithProgress[] {
  const allGoals = db
    .select()
    .from(goals)
    .where(eq(goals.isActive, true))
    .all();

  return allGoals.map((goal) => {
    const { currentValue, dataPoints } = getCurrentValueForGoal(goal);
    const progress =
      currentValue !== null
        ? computeGoalProgress(goal, currentValue, dataPoints)
        : {
            currentValue: 0,
            baselineValue: goal.baselineValue ?? null,
            targetValue: goal.targetValue,
            progressPercent: null,
            isOnTrack: null,
            projectedCompletionDate: null,
            status: "no_data" as const,
          };

    return { goal, progress };
  });
}

export function getGoalById(id: string): GoalWithProgress | null {
  const [goal] = db.select().from(goals).where(eq(goals.id, id)).all();
  if (!goal) return null;

  const { currentValue, dataPoints } = getCurrentValueForGoal(goal);
  const progress =
    currentValue !== null
      ? computeGoalProgress(goal, currentValue, dataPoints)
      : {
          currentValue: 0,
          baselineValue: goal.baselineValue ?? null,
          targetValue: goal.targetValue,
          progressPercent: null,
          isOnTrack: null,
          projectedCompletionDate: null,
          status: "no_data" as const,
        };

  return { goal, progress };
}
