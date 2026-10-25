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
import { projectGoalCompletion, withCurrentPhysicalAssets } from "@/lib/engine/net-worth";
import {
  effectiveBaseline,
  goalProgressPercent,
  goalReachedTarget,
  goalTracksDecrease,
  storedGoalDirection,
} from "@/lib/goals/progress";
import { totalPhysicalAssetsGbp } from "@/lib/services/physical-assets";
import { listFiles, deleteFile, type FileRow } from "@/lib/services/files";
import type { GoalMetricType } from "@/db/schema";
import type { CreateGoalInput, UpdateGoalInput } from "@/lib/validators/goals";

export class GoalValidationError extends Error {}

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
  files: FileRow[];
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
    const snapshots = withCurrentPhysicalAssets(allSnapshots, totalPhysicalAssetsGbp());
    const dataPoints = snapshots
      .filter((s) => s.netWorthGbp !== null)
      .map((s) => ({
        timestamp: new Date(s.takenAt).getTime(),
        value: s.netWorthGbp!,
      }));

    const lastSnapshot = snapshots[snapshots.length - 1];
    const currentValue =
      lastSnapshot && lastSnapshot.netWorthGbp !== null ? lastSnapshot.netWorthGbp : null;

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

  if (goal.metricType === "DEBT_PAYOFF") {
    return debtSeriesForGoal(goal.linkedAccountId, allSnapshots);
  }

  return { currentValue: null, dataPoints: [] };
}

/**
 * Same debt figure as the overview DEBT KPI: sum of LIABILITY valuations.
 * A linked account limits that to one loan. Snapshots are oldest-first.
 */
function debtSeriesForGoal(
  linkedAccountId: string | null,
  allSnapshots: ReturnType<typeof getAllCommittedSnapshots>
): { currentValue: number | null; dataPoints: Array<{ timestamp: number; value: number }> } {
  const liabilityIds = new Set(
    db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.type, "LIABILITY"))
      .all()
      .map((account) => account.id)
  );

  if (linkedAccountId) {
    if (!liabilityIds.has(linkedAccountId)) {
      return { currentValue: null, dataPoints: [] };
    }
  }

  const trackedIds = linkedAccountId ? new Set([linkedAccountId]) : liabilityIds;
  const dataPoints: Array<{ timestamp: number; value: number }> = [];

  for (const snap of allSnapshots) {
    const valuations = db
      .select()
      .from(accountValuations)
      .where(eq(accountValuations.snapshotId, snap.id))
      .all();

    if (valuations.length === 0) continue;

    if (linkedAccountId) {
      const match = valuations.find((valuation) => valuation.accountId === linkedAccountId);
      if (!match) continue;
      dataPoints.push({
        timestamp: new Date(snap.takenAt).getTime(),
        value: match.valueGbp,
      });
      continue;
    }

    const total = valuations.reduce((sum, valuation) => {
      return trackedIds.has(valuation.accountId) ? sum + valuation.valueGbp : sum;
    }, 0);
    dataPoints.push({
      timestamp: new Date(snap.takenAt).getTime(),
      value: total,
    });
  }

  const currentValue = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].value : null;
  return { currentValue, dataPoints };
}

// ─── Pure computation ─────────────────────────────────────────────────────────

export function computeGoalProgress(
  goal: GoalRow,
  currentValue: number,
  dataPoints: Array<{ timestamp: number; value: number }> = []
): GoalProgress {
  const decrease = goalTracksDecrease(goal);
  const target = goal.targetValue;
  const baseline = effectiveBaseline(goal.baselineValue, dataPoints);
  const progressPercent = goalProgressPercent(currentValue, baseline, target);
  const reached = goalReachedTarget(decrease, currentValue, target);

  if (goal.completedAt) {
    return {
      currentValue: decrease ? currentValue : Math.max(currentValue, target),
      baselineValue: baseline,
      targetValue: target,
      progressPercent: 100,
      isOnTrack: true,
      projectedCompletionDate: null,
      status: "achieved",
    };
  }

  if (reached) {
    return {
      currentValue,
      baselineValue: baseline,
      targetValue: target,
      progressPercent: progressPercent ?? 100,
      isOnTrack: true,
      projectedCompletionDate: null,
      status: "achieved",
    };
  }

  if (dataPoints.length < 2) {
    return {
      currentValue,
      baselineValue: baseline,
      targetValue: target,
      progressPercent,
      isOnTrack: null,
      projectedCompletionDate: null,
      status: "no_data",
    };
  }

  const projectedDate = projectGoalCompletion(dataPoints, target);
  const targetDate = new Date(goal.targetDate);
  const isOnTrack = projectedDate !== null ? projectedDate <= targetDate : false;
  const status = isOnTrack ? "on_track" : "at_risk";

  return {
    currentValue,
    baselineValue: baseline,
    targetValue: target,
    progressPercent,
    isOnTrack,
    projectedCompletionDate: projectedDate,
    status,
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

function assertLiabilityAccount(accountId: string | null | undefined): void {
  if (!accountId) return;
  const [account] = db.select().from(accounts).where(eq(accounts.id, accountId)).all();
  if (!account || account.type !== "LIABILITY") {
    throw new GoalValidationError("linkedAccountId must be a liability account");
  }
}

function linksForMetric(
  metricType: GoalMetricType,
  input: {
    linkedMetricId?: string | null;
    linkedCategory?: CreateGoalInput["linkedCategory"];
    linkedAccountId?: string | null;
  },
  existing?: GoalRow
): Pick<GoalRow, "linkedMetricId" | "linkedCategory" | "linkedAccountId"> {
  return {
    linkedMetricId:
      metricType === "LIFE_METRIC"
        ? (input.linkedMetricId !== undefined
            ? input.linkedMetricId
            : existing?.linkedMetricId ?? null)
        : null,
    linkedCategory:
      metricType === "ACCOUNT_CATEGORY"
        ? (input.linkedCategory !== undefined
            ? input.linkedCategory ?? null
            : existing?.linkedCategory ?? null)
        : null,
    linkedAccountId:
      metricType === "DEBT_PAYOFF"
        ? (input.linkedAccountId !== undefined
            ? input.linkedAccountId
            : existing?.linkedAccountId ?? null)
        : null,
  };
}

export function createGoal(input: CreateGoalInput): GoalRow {
  const id = randomUUID();
  const direction = storedGoalDirection(input.metricType, input.direction);
  const links = linksForMetric(input.metricType, input);
  assertLiabilityAccount(links.linkedAccountId);

  let baselineValue = input.baselineValue ?? null;
  let baselineDate = input.baselineDate ?? null;

  // Auto-set baseline from the latest snapshot if not provided.
  // For a debt goal this is the liability balance at creation.
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
        direction,
        linkedMetricId: links.linkedMetricId,
        linkedCategory: links.linkedCategory,
        linkedAccountId: links.linkedAccountId,
        baselineValue: null,
        baselineDate: null,
        completedAt: input.completedAt ?? null,
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
      direction,
      linkedMetricId: links.linkedMetricId,
      linkedCategory: links.linkedCategory,
      linkedAccountId: links.linkedAccountId,
      baselineValue,
      baselineDate,
      completedAt: input.completedAt ?? null,
      isActive: input.isActive ?? true,
    })
    .run();

  const [row] = db.select().from(goals).where(eq(goals.id, id)).all();
  return row;
}

export function updateGoal(id: string, input: UpdateGoalInput): GoalRow {
  const existing = db.select().from(goals).where(eq(goals.id, id)).all()[0];
  if (!existing) throw new Error(`Goal not found: ${id}`);

  const metricType = input.metricType ?? existing.metricType;
  const direction = storedGoalDirection(
    metricType,
    input.direction !== undefined ? input.direction : existing.direction
  );
  const links = linksForMetric(metricType, input, existing);
  assertLiabilityAccount(links.linkedAccountId);

  if (input.targetValue !== undefined && !goalTracksDecrease({ metricType, direction })) {
    if (input.targetValue <= 0) {
      throw new GoalValidationError("targetValue must be positive");
    }
  }

  const metricChanged = metricType !== existing.metricType;
  const linkChanged =
    links.linkedAccountId !== existing.linkedAccountId ||
    links.linkedCategory !== existing.linkedCategory ||
    links.linkedMetricId !== existing.linkedMetricId;

  let baselineValue = input.baselineValue !== undefined ? input.baselineValue : existing.baselineValue;
  let baselineDate = input.baselineDate !== undefined ? input.baselineDate : existing.baselineDate;

  if (input.baselineValue === undefined && (metricChanged || linkChanged)) {
    const latestSnapshot = getLatestCommittedSnapshot();
    const { currentValue } = getCurrentValueForGoal({
      ...existing,
      metricType,
      direction,
      ...links,
    });
    if (currentValue !== null) {
      baselineValue = currentValue;
      baselineDate = latestSnapshot ? latestSnapshot.takenAt.slice(0, 10) : baselineDate;
    }
  }

  db.update(goals)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.targetValue !== undefined && { targetValue: input.targetValue }),
      ...(input.targetDate !== undefined && { targetDate: input.targetDate }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
      metricType,
      direction,
      ...links,
      baselineValue,
      baselineDate,
    })
    .where(eq(goals.id, id))
    .run();

  const [row] = db.select().from(goals).where(eq(goals.id, id)).all();
  return row;
}

export function deleteGoal(id: string): void {
  for (const file of listFiles("GOAL", id)) {
    deleteFile(file.id);
  }
  db.delete(goals).where(eq(goals.id, id)).run();
}

function progressForGoal(goal: GoalRow): GoalProgress {
  const { currentValue, dataPoints } = getCurrentValueForGoal(goal);
  if (currentValue !== null) {
    return computeGoalProgress(goal, currentValue, dataPoints);
  }
  if (goal.completedAt) {
    return computeGoalProgress(goal, 0, []);
  }
  return {
    currentValue: 0,
    baselineValue: goal.baselineValue ?? null,
    targetValue: goal.targetValue,
    progressPercent: null,
    isOnTrack: null,
    projectedCompletionDate: null,
    status: "no_data",
  };
}

function withProgress(goal: GoalRow): GoalWithProgress {
  return {
    goal,
    progress: progressForGoal(goal),
    files: listFiles("GOAL", goal.id),
  };
}

export function listGoals(): GoalWithProgress[] {
  const allGoals = db
    .select()
    .from(goals)
    .where(eq(goals.isActive, true))
    .all();

  return allGoals.map(withProgress);
}

export function getGoalById(id: string): GoalWithProgress | null {
  const [goal] = db.select().from(goals).where(eq(goals.id, id)).all();
  if (!goal) return null;
  return withProgress(goal);
}
