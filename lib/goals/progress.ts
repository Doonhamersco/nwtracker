import type { GoalDirection, GoalMetricType } from "@/db/schema";

export function goalTracksDecrease(goal: {
  metricType: string;
  direction?: string | null;
}): boolean {
  return goal.metricType === "DEBT_PAYOFF" || goal.direction === "decrease";
}

export function storedGoalDirection(
  metricType: GoalMetricType,
  direction: GoalDirection | null | undefined
): GoalDirection {
  if (metricType === "DEBT_PAYOFF") return "decrease";
  return direction === "decrease" ? "decrease" : "increase";
}

export function goalReachedTarget(
  decrease: boolean,
  currentValue: number,
  targetValue: number
): boolean {
  return decrease ? currentValue <= targetValue : currentValue >= targetValue;
}

/** (current - start) / (target - start). For a falling balance this is (start - current) / (start - target). */
export function goalProgressPercent(
  currentValue: number,
  startingValue: number | null,
  targetValue: number
): number | null {
  if (startingValue === null) return null;
  if (targetValue === startingValue) {
    return currentValue === targetValue ? 100 : null;
  }
  return ((currentValue - startingValue) / (targetValue - startingValue)) * 100;
}

/** Stored baseline, or the earliest snapshot when the goal was created without one. */
export function effectiveBaseline(
  storedBaseline: number | null | undefined,
  dataPoints: Array<{ value: number }>
): number | null {
  if (storedBaseline !== null && storedBaseline !== undefined) return storedBaseline;
  return dataPoints.length > 0 ? dataPoints[0].value : null;
}

export function goalDateCaption(input: {
  isCompleted: boolean;
  completedAt: string | null;
  projectedCompletionDate: string | null;
  formatDate: (iso: string) => string;
}): string {
  if (input.isCompleted) {
    return input.completedAt ? input.formatDate(input.completedAt) : "Target reached";
  }
  return input.projectedCompletionDate
    ? input.formatDate(input.projectedCompletionDate)
    : "Insufficient data";
}
