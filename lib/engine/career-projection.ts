import { DATE_OF_BIRTH } from "@/lib/constants";
import { growOneYear } from "@/lib/engine/compound";
import {
  accruedAnnualPension,
  commutePension,
  salaryForServiceYear,
  yearAccrual,
} from "@/lib/engine/police-care";
import { sippTopSliceAnnual } from "@/lib/engine/sipp-topslices";
import { monthlyTakeHome } from "@/lib/engine/scottish-tax";

export const DEFAULT_CONSTABLE_PAY_SCALE: number[] = Array.from(
  { length: 10 },
  (_, i) => Math.round(34_000 + (55_000 - 34_000) * (i / 9))
);

export const DEFAULT_START_DATE = "2026-10-01";

export const MILESTONE_YEARS = [5, 10, 20, 25, 30] as const;

export interface CareerPlanAssumptions {
  startDate: string;
  dateOfBirth: string;
  npa: number;
  sippAccessAge: number;
  policeContributionRate: number;
  accrualDivisor: number;
  scottishHigherRateThreshold: number;
  isaMonthlyGbp: number;
  expectedRealReturn: number;
  commutationFactor: number;
  commuteFraction: number;
  payScale: number[];
  projectionYears: number;
}

export function defaultAssumptions(): CareerPlanAssumptions {
  return {
    startDate: DEFAULT_START_DATE,
    dateOfBirth: DATE_OF_BIRTH,
    npa: 60,
    sippAccessAge: 57,
    policeContributionRate: 0.1344,
    accrualDivisor: 55.3,
    scottishHigherRateThreshold: 43_663,
    isaMonthlyGbp: 300,
    expectedRealReturn: 0.07,
    commutationFactor: 12,
    commuteFraction: 0.25,
    payScale: [...DEFAULT_CONSTABLE_PAY_SCALE],
    projectionYears: 30,
  };
}

export interface YearCashflow {
  serviceYear: number;
  age: number;
  date: string;
  grossAnnual: number;
  policeMonthly: number;
  sippMonthly: number;
  takeHomeMonthly: number;
  isaMonthly: number;
}

export interface YearProjection {
  serviceYear: number;
  age: number;
  date: string;
  grossAnnual: number;
  policeAccruedAnnual: number;
  isaPot: number;
  sippPot: number;
  combinedLiquid: number;
}

export interface CareerProjection {
  years: YearProjection[];
  cashflow: YearCashflow[];
  milestones: YearProjection[];
  atNpa: YearProjection | null;
  atSippAccess: YearProjection | null;
  commute: { reducedAnnual: number; lumpSum: number; commutedAnnual: number };
  sippPclsAtAccess: number;
}

export interface ActualPots {
  isaGbp: number;
  sippGbp: number;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function ageOnDate(dateOfBirth: string, onDate: string): number {
  const dob = parseIsoDate(dateOfBirth);
  const on = parseIsoDate(onDate);
  let age = on.getFullYear() - dob.getFullYear();
  const birthdayPassed =
    on.getMonth() > dob.getMonth() ||
    (on.getMonth() === dob.getMonth() && on.getDate() >= dob.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

export function addYearsIso(iso: string, years: number): string {
  const d = parseIsoDate(iso);
  d.setFullYear(d.getFullYear() + years);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function serviceYearsElapsed(
  startDate: string,
  asOfDate: string
): number {
  const start = parseIsoDate(startDate).getTime();
  const asOf = parseIsoDate(asOfDate).getTime();
  if (asOf <= start) return 0;
  return (asOf - start) / (365.25 * 24 * 60 * 60 * 1000);
}

function nearestYearProjection(
  years: YearProjection[],
  targetAge: number
): YearProjection | null {
  if (years.length === 0) return null;
  let best = years[0];
  let bestDelta = Math.abs(best.age - targetAge);
  for (const row of years) {
    const delta = Math.abs(row.age - targetAge);
    if (delta < bestDelta) {
      best = row;
      bestDelta = delta;
    }
  }
  return best;
}

/**
 * Project the career from startDate. Opening ISA/SIPP balances are applied
 * at the later of startDate and today (passed in via asOfDate + actuals),
 * then remaining service years receive planned contributions.
 *
 * CARE accrual always runs from year 1 of service regardless of actuals.
 */
export function projectCareer(
  assumptions: CareerPlanAssumptions,
  actuals: ActualPots = { isaGbp: 0, sippGbp: 0 },
  asOfDate?: string
): CareerProjection {
  const today = asOfDate ?? new Date().toISOString().slice(0, 10);
  const elapsed = serviceYearsElapsed(assumptions.startDate, today);
  const elapsedWhole = Math.min(
    assumptions.projectionYears,
    Math.max(0, Math.floor(elapsed))
  );

  let isaPot = actuals.isaGbp;
  let sippPot = actuals.sippGbp;
  let policeAccrued = accruedAnnualPension(
    assumptions.payScale,
    assumptions.accrualDivisor,
    elapsedWhole
  );

  const years: YearProjection[] = [];
  const cashflow: YearCashflow[] = [];

  for (let serviceYear = 1; serviceYear <= assumptions.projectionYears; serviceYear++) {
    const date = addYearsIso(assumptions.startDate, serviceYear);
    const age = ageOnDate(assumptions.dateOfBirth, date);
    const grossAnnual = salaryForServiceYear(assumptions.payScale, serviceYear);
    const sippAnnual = sippTopSliceAnnual(
      grossAnnual,
      assumptions.policeContributionRate,
      assumptions.scottishHigherRateThreshold
    );

    cashflow.push({
      serviceYear,
      age,
      date,
      grossAnnual,
      policeMonthly: (grossAnnual * assumptions.policeContributionRate) / 12,
      sippMonthly: sippAnnual / 12,
      takeHomeMonthly: monthlyTakeHome({
        grossAnnual,
        policeContributionRate: assumptions.policeContributionRate,
        sippAnnual,
        higherRateThreshold: assumptions.scottishHigherRateThreshold,
      }),
      isaMonthly: assumptions.isaMonthlyGbp,
    });

    if (serviceYear > elapsedWhole) {
      isaPot = growOneYear(
        isaPot,
        assumptions.isaMonthlyGbp * 12,
        assumptions.expectedRealReturn
      );
      sippPot = growOneYear(sippPot, sippAnnual, assumptions.expectedRealReturn);
      policeAccrued += yearAccrual(grossAnnual, assumptions.accrualDivisor);
    }

    years.push({
      serviceYear,
      age,
      date,
      grossAnnual,
      policeAccruedAnnual: policeAccrued,
      isaPot,
      sippPot,
      combinedLiquid: isaPot + sippPot,
    });
  }

  const final = years[years.length - 1];
  const commute = commutePension(
    final?.policeAccruedAnnual ?? 0,
    assumptions.commutationFactor,
    assumptions.commuteFraction
  );

  const milestones = years.filter((y) =>
    (MILESTONE_YEARS as readonly number[]).includes(y.serviceYear)
  );

  const atNpa = nearestYearProjection(years, assumptions.npa);
  const atSippAccess = nearestYearProjection(years, assumptions.sippAccessAge);

  return {
    years,
    cashflow,
    milestones,
    atNpa,
    atSippAccess,
    commute,
    sippPclsAtAccess: (atSippAccess?.sippPot ?? 0) * 0.25,
  };
}

/** Planned path from £0 at startDate (ignores actuals) — used for on-track overlay. */
export function plannedPathFromZero(
  assumptions: CareerPlanAssumptions
): YearProjection[] {
  return projectCareer(assumptions, { isaGbp: 0, sippGbp: 0 }, assumptions.startDate)
    .years;
}
