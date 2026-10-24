import type { TrainingPayload } from "@/lib/training/types";

/** Frozen sample used by the dev-only preview route. Not live Strava data. */
export function previewTrainingConnected(): TrainingPayload {
  return {
    testDate: "2026-11-24",
    testLabel: "Bleep test and 1.5-mile run",
    countdownDays: 31,
    strava: {
      configured: true,
      summary: {
        weeklyDistanceKm: 18.6,
        weeklySessions: 3,
        weekStart: "2026-10-19",
        runsLast7Days: 4,
        onTrack: "on_track",
        targetRunsPerWeek: 3,
        paceTrend: {
          direction: "faster",
          recentSecPerKm: 318,
          previousSecPerKm: 326,
          deltaSecPerKm: -8,
        },
        weeklyPace: [
          { weekStart: "2026-08-31", paceSecPerKm: 340, distanceKm: 22.4, sessions: 3 },
          { weekStart: "2026-09-07", paceSecPerKm: 336, distanceKm: 18.1, sessions: 3 },
          { weekStart: "2026-09-14", paceSecPerKm: 332, distanceKm: 24.0, sessions: 4 },
          { weekStart: "2026-09-21", paceSecPerKm: 330, distanceKm: 16.5, sessions: 3 },
          { weekStart: "2026-09-28", paceSecPerKm: 328, distanceKm: 21.2, sessions: 3 },
          { weekStart: "2026-10-05", paceSecPerKm: 324, distanceKm: 19.4, sessions: 3 },
          { weekStart: "2026-10-12", paceSecPerKm: 320, distanceKm: 23.1, sessions: 4 },
          { weekStart: "2026-10-19", paceSecPerKm: 318, distanceKm: 18.6, sessions: 3 },
        ],
        recentRuns: [
          {
            id: 5,
            name: "Easy shakeout",
            date: "2026-10-23",
            sport: "road",
            distanceKm: 5.2,
            paceSecPerKm: 332,
            movingTimeSeconds: 1726,
          },
          {
            id: 4,
            name: "Evening run",
            date: "2026-10-22",
            sport: "road",
            distanceKm: 8.4,
            paceSecPerKm: 316,
            movingTimeSeconds: 2654,
          },
          {
            id: 3,
            name: "Intervals",
            date: "2026-10-20",
            sport: "road",
            distanceKm: 6.2,
            paceSecPerKm: 298,
            movingTimeSeconds: 1848,
          },
          {
            id: 2,
            name: "Long run",
            date: "2026-10-18",
            sport: "road",
            distanceKm: 14.1,
            paceSecPerKm: 332,
            movingTimeSeconds: 4681,
          },
          {
            id: 1,
            name: "1.5 mile effort",
            date: "2026-10-12",
            sport: "road",
            distanceKm: 2.41,
            paceSecPerKm: 291,
            movingTimeSeconds: 702,
          },
        ],
        bestOnePointFiveMile: { timeSeconds: 702, date: "2026-10-12", source: "activity" },
        bestFiveK: { timeSeconds: 1428, date: "2026-09-28", source: "best_effort" },
      },
    },
    hevy: {
      available: true,
      streakDays: 9,
      streakCapped: false,
      weeklyVolumeKg: 18420,
      workoutsThisWeek: 4,
    },
  };
}

export function previewTrainingUnconfigured(): TrainingPayload {
  return {
    testDate: "2026-11-24",
    testLabel: "Bleep test and 1.5-mile run",
    countdownDays: 31,
    strava: { configured: false },
    hevy: {
      available: true,
      streakDays: 9,
      streakCapped: false,
      weeklyVolumeKg: 18420,
      workoutsThisWeek: 4,
    },
  };
}
