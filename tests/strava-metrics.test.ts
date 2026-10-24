import { describe, expect, it } from "vitest";
import {
  estimateOnePointFiveFromKmSplits,
  estimateOnePointFiveFromMileSplits,
  formatPace,
  formatRaceTime,
  summarizeCardio,
} from "@/lib/strava/metrics";
import { normalizeStravaRun, type NormalizedRun } from "@/lib/strava/normalize";

const NOW = new Date("2026-10-24T12:00:00Z");

function run(overrides: Partial<NormalizedRun> & Pick<NormalizedRun, "id" | "date">): NormalizedRun {
  const distanceMeters = overrides.distanceMeters ?? 5000;
  const movingTimeSeconds = overrides.movingTimeSeconds ?? 1500;
  return {
    id: overrides.id,
    name: overrides.name ?? "Run",
    sport: overrides.sport ?? "road",
    date: overrides.date,
    startLocal: overrides.startLocal ?? `${overrides.date}T07:00:00`,
    distanceMeters,
    movingTimeSeconds,
    efforts: overrides.efforts ?? [],
    kmSplits: overrides.kmSplits ?? [],
    mileSplits: overrides.mileSplits ?? [],
  };
}

describe("summarizeCardio", () => {
  const runs = [
    run({ id: 1, date: "2026-10-22", distanceMeters: 5000, movingTimeSeconds: 1500 }),
    run({ id: 2, date: "2026-10-21", distanceMeters: 5000, movingTimeSeconds: 1500 }),
    run({
      id: 3,
      date: "2026-10-20",
      sport: "trail",
      name: "Hill trail",
      distanceMeters: 10_000,
      movingTimeSeconds: 4000,
    }),
    run({ id: 4, date: "2026-09-10", distanceMeters: 5000, movingTimeSeconds: 1800 }),
    run({ id: 5, date: "2026-09-11", distanceMeters: 5000, movingTimeSeconds: 1800 }),
  ];

  it("counts trail runs toward weekly distance and frequency, not pace", () => {
    const summary = summarizeCardio(runs, NOW);

    expect(summary.weekStart).toBe("2026-10-19");
    expect(summary.weeklySessions).toBe(3);
    expect(summary.weeklyDistanceKm).toBeCloseTo(20);
    expect(summary.runsLast7Days).toBe(3);
    expect(summary.onTrack).toBe("on_track");
    expect(summary.paceTrend.direction).toBe("faster");
    expect(summary.paceTrend.recentSecPerKm).toBeCloseTo(300);
    expect(summary.paceTrend.previousSecPerKm).toBeCloseTo(360);
    expect(summary.paceTrend.deltaSecPerKm).toBeCloseTo(-60);
    expect(summary.recentRuns.map((item) => item.id)).toEqual([1, 2, 3, 5, 4]);
    expect(summary.recentRuns[2]?.sport).toBe("trail");
  });

  it("marks frequency as building or off track", () => {
    expect(summarizeCardio([run({ id: 1, date: "2026-10-24" })], NOW).onTrack).toBe("building");
    expect(summarizeCardio([run({ id: 1, date: "2026-10-10" })], NOW).onTrack).toBe("off_track");
  });

  it("calls a small pace change steady and a missing window insufficient", () => {
    const steady = summarizeCardio(
      [
        run({ id: 1, date: "2026-10-22", distanceMeters: 5000, movingTimeSeconds: 1500 }),
        run({ id: 2, date: "2026-10-21", distanceMeters: 5000, movingTimeSeconds: 1505 }),
        run({ id: 3, date: "2026-09-10", distanceMeters: 5000, movingTimeSeconds: 1500 }),
        run({ id: 4, date: "2026-09-11", distanceMeters: 5000, movingTimeSeconds: 1510 }),
      ],
      NOW,
    );
    expect(steady.paceTrend.direction).toBe("steady");

    const thin = summarizeCardio(
      [run({ id: 1, date: "2026-10-22", distanceMeters: 5000, movingTimeSeconds: 1500 })],
      NOW,
    );
    expect(thin.paceTrend.direction).toBe("insufficient");
    expect(thin.paceTrend.deltaSecPerKm).toBeNull();
    expect(thin.weeklyPace.find((week) => week.weekStart === "2026-10-19")?.paceSecPerKm).toBeCloseTo(300);
  });

  it("takes the faster measured 5K from a best effort or a time trial", () => {
    const summary = summarizeCardio(
      [
        run({
          id: 1,
          date: "2026-09-28",
          distanceMeters: 10_000,
          movingTimeSeconds: 3600,
          efforts: [{ name: "5k", distanceMeters: 5000, elapsedTimeSeconds: 1428 }],
        }),
        run({
          id: 2,
          date: "2026-10-02",
          distanceMeters: 5050,
          movingTimeSeconds: 1500,
        }),
        run({
          id: 3,
          date: "2026-10-03",
          distanceMeters: 5300,
          movingTimeSeconds: 1200,
          name: "Not a 5K",
        }),
      ],
      NOW,
    );

    expect(summary.bestFiveK?.source).toBe("best_effort");
    expect(summary.bestFiveK?.timeSeconds).toBe(1428);
    expect(summary.bestFiveK?.date).toBe("2026-09-28");
  });

  it("prefers a measured 1.5-mile time over a faster split estimate", () => {
    const summary = summarizeCardio(
      [
        run({
          id: 1,
          date: "2026-10-12",
          distanceMeters: 2414.016,
          movingTimeSeconds: 750,
          kmSplits: [
            { distanceMeters: 1000, movingTimeSeconds: 200 },
            { distanceMeters: 1000, movingTimeSeconds: 200 },
            { distanceMeters: 1000, movingTimeSeconds: 200 },
          ],
        }),
      ],
      NOW,
    );

    expect(summary.bestOnePointFiveMile).toMatchObject({
      source: "activity",
      timeSeconds: 750,
      date: "2026-10-12",
    });
  });

  it("estimates 1.5 miles from kilometre splits before mile splits", () => {
    const km = [
      { distanceMeters: 1000, movingTimeSeconds: 300 },
      { distanceMeters: 1000, movingTimeSeconds: 300 },
      { distanceMeters: 1000, movingTimeSeconds: 300 },
    ];
    const miles = [
      { distanceMeters: 1609.344, movingTimeSeconds: 400 },
      { distanceMeters: 1609.344, movingTimeSeconds: 400 },
    ];
    const fromKm = estimateOnePointFiveFromKmSplits(km);
    expect(fromKm).toBeCloseTo(300 + 300 + ((2414.016 - 2000) / 1000) * 300);

    const summary = summarizeCardio(
      [
        run({
          id: 1,
          date: "2026-10-04",
          distanceMeters: 8000,
          movingTimeSeconds: 2400,
          kmSplits: km,
          mileSplits: miles,
        }),
      ],
      NOW,
    );
    expect(summary.bestOnePointFiveMile?.source).toBe("splits");
    expect(summary.bestOnePointFiveMile?.timeSeconds).toBeCloseTo(fromKm ?? 0);
    expect(estimateOnePointFiveFromMileSplits(miles)).toBe(600);
  });

  it("uses mile splits when kilometre splits are missing", () => {
    const summary = summarizeCardio(
      [
        run({
          id: 1,
          date: "2026-10-04",
          distanceMeters: 8000,
          movingTimeSeconds: 2400,
          mileSplits: [
            { distanceMeters: 1609, movingTimeSeconds: 480 },
            { distanceMeters: 1609, movingTimeSeconds: 500 },
          ],
        }),
      ],
      NOW,
    );
    expect(summary.bestOnePointFiveMile?.timeSeconds).toBeCloseTo(480 + 250);
  });

  it("ignores trail best efforts", () => {
    const summary = summarizeCardio(
      [
        run({
          id: 1,
          date: "2026-10-04",
          sport: "trail",
          distanceMeters: 5000,
          movingTimeSeconds: 900,
          efforts: [{ name: "5K", distanceMeters: 5000, elapsedTimeSeconds: 900 }],
        }),
      ],
      NOW,
    );
    expect(summary.bestFiveK).toBeNull();
    expect(summary.bestOnePointFiveMile).toBeNull();
  });

  it("returns an empty summary when there are no runs", () => {
    const summary = summarizeCardio([], NOW);
    expect(summary.weeklySessions).toBe(0);
    expect(summary.onTrack).toBe("off_track");
    expect(summary.recentRuns).toEqual([]);
    expect(summary.weeklyPace).toHaveLength(8);
    expect(summary.bestFiveK).toBeNull();
  });
});

describe("pace and race formatting", () => {
  it("formats pace and race time", () => {
    expect(formatPace(318)).toBe("5:18/km");
    expect(formatRaceTime(702)).toBe("11:42");
    expect(formatRaceTime(1428)).toBe("23:48");
    expect(formatRaceTime(3723)).toBe("1:02:03");
  });
});

describe("normalizeStravaRun", () => {
  it("keeps runs and drops rides", () => {
    expect(
      normalizeStravaRun({
        id: 9,
        name: "Park loop",
        sport_type: "Run",
        start_date_local: "2026-10-22T18:04:00",
        distance: 5200,
        moving_time: 1600,
        best_efforts: [{ name: "5k", distance: 5000, elapsed_time: 1500, moving_time: 1490 }],
      }),
    ).toMatchObject({
      id: 9,
      sport: "road",
      date: "2026-10-22",
      efforts: [{ name: "5k", elapsedTimeSeconds: 1500 }],
    });

    expect(
      normalizeStravaRun({
        id: 10,
        sport_type: "Ride",
        type: "Ride",
        start_date_local: "2026-10-22T18:04:00",
        distance: 20000,
        moving_time: 3000,
      }),
    ).toBeNull();
  });

  it("classifies treadmill and trail runs", () => {
    expect(
      normalizeStravaRun({
        id: 1,
        sport_type: "VirtualRun",
        start_date: "2026-10-22T18:04:00Z",
        distance: 5000,
        moving_time: 1500,
      })?.sport,
    ).toBe("virtual");
    expect(
      normalizeStravaRun({
        id: 2,
        sport_type: "TrailRun",
        start_date_local: "2026-10-22T18:04:00",
        distance: 5000,
        moving_time: 1500,
      })?.sport,
    ).toBe("trail");
  });
});
