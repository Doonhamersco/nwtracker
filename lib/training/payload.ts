import { daysUntil, FITNESS_TEST_DATE, FITNESS_TEST_LABEL, londonToday } from "./dates";
import type { HevyTraining, StravaState, TrainingPayload } from "./types";

export async function buildTrainingPayload(deps: {
  now: Date;
  loadStrava: () => Promise<StravaState>;
  loadHevy: () => Promise<HevyTraining>;
}): Promise<TrainingPayload> {
  const [strava, hevy] = await Promise.all([
    deps.loadStrava().catch(
      (): StravaState => ({
        configured: true,
        error: "Could not load runs from Strava.",
      }),
    ),
    deps.loadHevy().catch(
      (): HevyTraining => ({
        available: false,
        reason: "error",
      }),
    ),
  ]);

  return {
    testDate: FITNESS_TEST_DATE,
    testLabel: FITNESS_TEST_LABEL,
    countdownDays: daysUntil(londonToday(deps.now), FITNESS_TEST_DATE),
    strava,
    hevy,
  };
}
