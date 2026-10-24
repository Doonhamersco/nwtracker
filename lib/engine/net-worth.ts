/**
 * Pure net worth computation functions.
 * No database dependency — all inputs are plain data.
 * Historical snapshots use the FX rate stored at snapshot creation time.
 */

export type AccountType = "ASSET" | "LIABILITY";

export interface ValuationInput {
  accountType: AccountType;
  valueNative: number;
  /** GBP rate for the native currency at snapshot time */
  fxRateToGbp: number;
}

export interface ValuationResult {
  valueGbp: number;
  accountType: AccountType;
}

/**
 * Convert a single account valuation to GBP using the FX rate
 * that was captured at snapshot creation — never today's rate.
 */
export function convertToGbp(valueNative: number, fxRateToGbp: number): number {
  if (fxRateToGbp <= 0) throw new Error("FX rate must be positive");
  return valueNative * fxRateToGbp;
}

/**
 * Compute net worth from a set of valuations (already in GBP).
 * Assets are summed; liabilities are subtracted.
 */
export function computeNetWorth(valuations: ValuationResult[]): number {
  return valuations.reduce((total, v) => {
    return v.accountType === "ASSET"
      ? total + v.valueGbp
      : total - v.valueGbp;
  }, 0);
}

/**
 * Convenience: convert then compute in one step.
 * Used at snapshot commit time to materialise net_worth_gbp.
 */
export function computeNetWorthFromInputs(inputs: ValuationInput[]): {
  netWorthGbp: number;
  valuations: ValuationResult[];
} {
  const valuations: ValuationResult[] = inputs.map((v) => ({
    accountType: v.accountType,
    valueGbp: convertToGbp(v.valueNative, v.fxRateToGbp),
  }));
  return { netWorthGbp: computeNetWorth(valuations), valuations };
}

export interface SnapshotWorth {
  id: string;
  takenAt: string;
  netWorthGbp: number | null;
  isPartial: boolean;
  /** Physical-asset portion already baked into netWorthGbp. Null before that column existed. */
  physicalAssetsGbp?: number | null;
}

/**
 * Keep historical points as they were stored. The latest committed point
 * swaps the physical-asset amount captured at check-in for today's total,
 * so the overview and the right-hand end of the chart follow current values
 * without rewriting earlier months.
 */
export function findLatestCommittedSnapshot<T extends SnapshotWorth>(
  snapshots: T[]
): T | null {
  return (
    snapshots
      .filter((snapshot) => !snapshot.isPartial && snapshot.netWorthGbp !== null)
      .slice()
      .sort((a, b) => takenAtMs(b.takenAt) - takenAtMs(a.takenAt))[0] ?? null
  );
}

/**
 * Physical-asset pounds sitting inside netWorthGbp after withCurrentPhysicalAssets.
 * The latest committed point holds today's total; earlier points hold the amount
 * stored at check-in.
 */
export function physicalAssetsInDisplayedWorth(
  snapshot: Pick<SnapshotWorth, "id" | "physicalAssetsGbp">,
  latestCommittedId: string | null,
  currentPhysicalAssetsGbp: number
): number {
  if (latestCommittedId !== null && snapshot.id === latestCommittedId) {
    return currentPhysicalAssetsGbp;
  }
  return snapshot.physicalAssetsGbp ?? 0;
}

export function withCurrentPhysicalAssets<T extends SnapshotWorth>(
  snapshots: T[],
  currentPhysicalAssetsGbp: number
): T[] {
  const latest = findLatestCommittedSnapshot(snapshots);
  if (!latest || latest.netWorthGbp === null) return snapshots;

  const included = latest.physicalAssetsGbp ?? 0;
  const netWorthGbp = roundMoney(
    latest.netWorthGbp - included + currentPhysicalAssetsGbp
  );
  return snapshots.map((snapshot) =>
    snapshot.id === latest.id ? { ...snapshot, netWorthGbp } : snapshot
  );
}

function takenAtMs(value: string): number {
  const normalised = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = Date.parse(normalised);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Month-over-month change.
 */
export function computeMoMChange(
  current: number,
  previous: number | null
): { absoluteChange: number | null; percentChange: number | null } {
  if (previous === null || previous === undefined) {
    return { absoluteChange: null, percentChange: null };
  }
  const absoluteChange = current - previous;
  const percentChange = previous === 0 ? null : (absoluteChange / Math.abs(previous)) * 100;
  return { absoluteChange, percentChange };
}

/**
 * Savings rate: (income - spend) / income × 100.
 * Returns null if income is zero or negative.
 */
export function computeSavingsRate(
  monthlyIncomeGbp: number,
  monthlySpendGbp: number
): number | null {
  if (monthlyIncomeGbp <= 0) return null;
  return ((monthlyIncomeGbp - monthlySpendGbp) / monthlyIncomeGbp) * 100;
}

/**
 * Linear regression projection for goal completion.
 * Given a series of (timestamp, value) points, projects when `targetValue` will be reached.
 * Returns null if the trend is flat or moving away from target.
 */
export function projectGoalCompletion(
  dataPoints: Array<{ timestamp: number; value: number }>,
  targetValue: number
): Date | null {
  if (dataPoints.length < 2) return null;

  const n = dataPoints.length;
  const sumX = dataPoints.reduce((s, p) => s + p.timestamp, 0);
  const sumY = dataPoints.reduce((s, p) => s + p.value, 0);
  const sumXY = dataPoints.reduce((s, p) => s + p.timestamp * p.value, 0);
  const sumXX = dataPoints.reduce((s, p) => s + p.timestamp * p.timestamp, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  if (slope === 0) return null;

  const projectedTimestamp = (targetValue - intercept) / slope;

  // Only return a future projection
  const now = Date.now();
  if (projectedTimestamp <= now) return null;

  return new Date(projectedTimestamp);
}
