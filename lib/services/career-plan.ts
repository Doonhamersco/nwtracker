import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  CAREER_PLAN_ID,
  careerPlans,
  accounts,
  snapshots,
  accountValuations,
} from "@/db/schema";
import type { UpdateCareerPlanInput } from "@/lib/validators/career-plan";
import type { PlanActuals, PlanPayload, PotPoint } from "@/lib/plan-types";
import {
  defaultAssumptions,
  plannedPathFromZero,
  projectCareer,
  type CareerPlanAssumptions,
} from "@/lib/engine/career-projection";

export type CareerPlanRow = typeof careerPlans.$inferSelect;
export type { PlanActuals, PlanPayload };

function parsePayScale(json: string): number[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed) || parsed.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
      return defaultAssumptions().payScale;
    }
    return parsed as number[];
  } catch {
    return defaultAssumptions().payScale;
  }
}

export function rowToAssumptions(row: CareerPlanRow): CareerPlanAssumptions {
  return {
    startDate: row.startDate,
    dateOfBirth: row.dateOfBirth,
    npa: row.npa,
    sippAccessAge: row.sippAccessAge,
    policeContributionRate: row.policeContributionRate,
    accrualDivisor: row.accrualDivisor,
    scottishHigherRateThreshold: row.scottishHigherRateThreshold,
    isaMonthlyGbp: row.isaMonthlyGbp,
    expectedRealReturn: row.expectedRealReturn,
    commutationFactor: row.commutationFactor,
    commuteFraction: row.commuteFraction,
    payScale: parsePayScale(row.payScaleJson),
    projectionYears: row.projectionYears,
  };
}

function insertDefaults(): CareerPlanRow {
  const defaults = defaultAssumptions();
  db.insert(careerPlans)
    .values({
      id: CAREER_PLAN_ID,
      startDate: defaults.startDate,
      dateOfBirth: defaults.dateOfBirth,
      npa: defaults.npa,
      sippAccessAge: defaults.sippAccessAge,
      policeContributionRate: defaults.policeContributionRate,
      accrualDivisor: defaults.accrualDivisor,
      scottishHigherRateThreshold: defaults.scottishHigherRateThreshold,
      isaMonthlyGbp: defaults.isaMonthlyGbp,
      expectedRealReturn: defaults.expectedRealReturn,
      commutationFactor: defaults.commutationFactor,
      commuteFraction: defaults.commuteFraction,
      payScaleJson: JSON.stringify(defaults.payScale),
      projectionYears: defaults.projectionYears,
    })
    .run();
  const [row] = db
    .select()
    .from(careerPlans)
    .where(eq(careerPlans.id, CAREER_PLAN_ID))
    .all();
  return row;
}

export function getCareerPlanRow(): CareerPlanRow {
  const [row] = db
    .select()
    .from(careerPlans)
    .where(eq(careerPlans.id, CAREER_PLAN_ID))
    .all();
  return row ?? insertDefaults();
}

function accountIdsForPots(): { isaIds: Set<string>; sippIds: Set<string> } {
  const all = db.select({ id: accounts.id, category: accounts.category, wrapper: accounts.wrapper }).from(accounts).all();
  const isaIds = new Set(
    all
      .filter(
        (a) =>
          a.wrapper === "STOCKS_ISA" ||
          (a.category === "ISA" && a.wrapper !== "CASH_ISA" && a.wrapper !== "SIPP")
      )
      .map((a) => a.id)
  );
  const sippIds = new Set(all.filter((a) => a.wrapper === "SIPP").map((a) => a.id));
  return { isaIds, sippIds };
}

function sumValuations(
  snapshotId: string,
  accountIds: Set<string>
): number {
  if (accountIds.size === 0) return 0;
  const valuations = db
    .select()
    .from(accountValuations)
    .where(eq(accountValuations.snapshotId, snapshotId))
    .all();
  return valuations
    .filter((v) => accountIds.has(v.accountId))
    .reduce((sum, v) => sum + v.valueGbp, 0);
}

export function getPlanActuals(): PlanActuals {
  const { isaIds, sippIds } = accountIdsForPots();

  const committed = db
    .select()
    .from(snapshots)
    .where(eq(snapshots.isPartial, false))
    .orderBy(snapshots.takenAt)
    .all();

  const isaHistory: PotPoint[] = [];
  const sippHistory: PotPoint[] = [];

  for (const snap of committed) {
    const date = snap.takenAt.slice(0, 10);
    isaHistory.push({ date, valueGbp: sumValuations(snap.id, isaIds) });
    sippHistory.push({ date, valueGbp: sumValuations(snap.id, sippIds) });
  }

  const [latest] = db
    .select()
    .from(snapshots)
    .where(eq(snapshots.isPartial, false))
    .orderBy(desc(snapshots.takenAt))
    .limit(1)
    .all();

  return {
    isaGbp: latest ? sumValuations(latest.id, isaIds) : 0,
    sippGbp: latest ? sumValuations(latest.id, sippIds) : 0,
    isaHistory,
    sippHistory,
  };
}

export function getPlan(): PlanPayload {
  const row = getCareerPlanRow();
  const assumptions = rowToAssumptions(row);
  const actuals = getPlanActuals();
  const today = new Date().toISOString().slice(0, 10);
  const projection = projectCareer(
    assumptions,
    { isaGbp: actuals.isaGbp, sippGbp: actuals.sippGbp },
    today
  );
  return {
    assumptions,
    actuals,
    projection,
    planned: plannedPathFromZero(assumptions),
  };
}

export function updateCareerPlan(input: UpdateCareerPlanInput): PlanPayload {
  getCareerPlanRow();
  db.update(careerPlans)
    .set({
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth }),
      ...(input.npa !== undefined && { npa: input.npa }),
      ...(input.sippAccessAge !== undefined && { sippAccessAge: input.sippAccessAge }),
      ...(input.policeContributionRate !== undefined && {
        policeContributionRate: input.policeContributionRate,
      }),
      ...(input.accrualDivisor !== undefined && { accrualDivisor: input.accrualDivisor }),
      ...(input.scottishHigherRateThreshold !== undefined && {
        scottishHigherRateThreshold: input.scottishHigherRateThreshold,
      }),
      ...(input.isaMonthlyGbp !== undefined && { isaMonthlyGbp: input.isaMonthlyGbp }),
      ...(input.expectedRealReturn !== undefined && {
        expectedRealReturn: input.expectedRealReturn,
      }),
      ...(input.commutationFactor !== undefined && {
        commutationFactor: input.commutationFactor,
      }),
      ...(input.commuteFraction !== undefined && { commuteFraction: input.commuteFraction }),
      ...(input.payScale !== undefined && { payScaleJson: JSON.stringify(input.payScale) }),
      ...(input.projectionYears !== undefined && { projectionYears: input.projectionYears }),
      updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    })
    .where(eq(careerPlans.id, CAREER_PLAN_ID))
    .run();
  return getPlan();
}
