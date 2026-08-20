/**
 * One-time backfill: fetch all historical Hevy workouts and body measurements,
 * group by calendar month, and create partial snapshots with Hevy metric readings.
 *
 * Safe to run multiple times — skips months that already have Hevy readings.
 *
 * Usage: npx tsx db/backfill-hevy.ts
 */

import { randomUUID } from "crypto";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "./client";
import { lifeMetricDefinitions, lifeMetricReadings, snapshots } from "./schema";
import { hevyClient } from "../lib/hevy/client";

// ─── Guards ───────────────────────────────────────────────────────────────────

if (!process.env.HEVY_API_KEY) {
  console.log("HEVY_API_KEY is not set — nothing to backfill. Exiting.");
  process.exit(0);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM" for any ISO 8601 datetime string. */
function toYearMonth(isoString: string): string {
  return isoString.slice(0, 7);
}

/** Returns "YYYY-MM-DD HH:MM:SS" for SQLite (last moment of the given month, UTC). */
function lastMomentOfMonth(year: number, month: number): string {
  // Date.UTC(year, month, 0) = last day of the given month (month is 1-indexed here)
  const d = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return d.toISOString().replace("T", " ").slice(0, 19);
}

/** Returns { year, month, nextYear, nextMonth } for a "YYYY-MM" key. */
function parseMonthKey(key: string): {
  year: number;
  month: number;
  nextYear: number;
  nextMonth: number;
} {
  const [yearStr, monthStr] = key.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return { year, month, nextYear, nextMonth };
}

/** Zero-pads a number to 2 digits. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching Hevy metric definitions…");

  const hevyMetrics = await db
    .select()
    .from(lifeMetricDefinitions)
    .where(eq(lifeMetricDefinitions.isHevyMetric, true));

  if (hevyMetrics.length === 0) {
    console.log("No Hevy metric definitions found in DB. Have you run migrations/seeds?");
    process.exit(0);
  }

  const hevyMetricIds = hevyMetrics.map((m) => m.id);
  console.log(`Found ${hevyMetrics.length} Hevy metric(s): ${hevyMetrics.map((m) => m.name).join(", ")}`);

  // Find named metrics for lookup
  const workoutSessionsMetric = hevyMetrics.find((m) =>
    m.name.toLowerCase().includes("workout sessions"),
  );
  const trainingVolumeMetric = hevyMetrics.find((m) =>
    m.name.toLowerCase().includes("training volume"),
  );
  const personalRecordsMetric = hevyMetrics.find((m) =>
    m.name.toLowerCase().includes("personal records"),
  );

  // Body Weight metric (builtin, not Hevy)
  const [bodyWeightMetric] = await db
    .select()
    .from(lifeMetricDefinitions)
    .where(
      and(
        eq(lifeMetricDefinitions.isBuiltin, true),
        eq(lifeMetricDefinitions.name, "Body Weight"),
      ),
    )
    .limit(1);

  console.log(
    bodyWeightMetric
      ? `Body Weight metric found: ${bodyWeightMetric.id}`
      : "Body Weight metric not found — body weight readings will be skipped.",
  );

  // ── Fetch all data from Hevy ─────────────────────────────────────────────

  // The production API caps pageSize at 10, so we paginate manually with safe page sizes.
  console.log("\nFetching all workouts from Hevy API…");
  const allWorkouts: Awaited<ReturnType<typeof hevyClient.getAllWorkouts>> = [];
  {
    let page = 1;
    let pageCount = 1;
    while (page <= pageCount) {
      const res = await hevyClient.getWorkouts(page, 10);
      allWorkouts.push(...res.workouts);
      pageCount = res.page_count;
      page++;
    }
  }
  console.log(`  → ${allWorkouts.length} workouts fetched.`);

  console.log("Fetching all body measurements from Hevy API…");
  const allMeasurements: Awaited<ReturnType<typeof hevyClient.getAllBodyMeasurements>> = [];
  {
    let page = 1;
    let pageCount = 1;
    while (page <= pageCount) {
      const res = await hevyClient.getBodyMeasurements(page, 10);
      allMeasurements.push(...res.body_measurements);
      pageCount = res.page_count;
      page++;
    }
  }
  console.log(`  → ${allMeasurements.length} measurements fetched.`);

  // ── Group workouts by month ──────────────────────────────────────────────

  const workoutsByMonth = new Map<string, typeof allWorkouts>();
  for (const workout of allWorkouts) {
    const key = toYearMonth(workout.start_time);
    if (!workoutsByMonth.has(key)) workoutsByMonth.set(key, []);
    workoutsByMonth.get(key)!.push(workout);
  }

  // ── Group body measurements by month (pick closest to end of month) ──────

  const measurementsByMonth = new Map<string, (typeof allMeasurements)[0]>();
  for (const m of allMeasurements) {
    if (m.weight_kg == null) continue;
    const key = toYearMonth(m.date);
    const existing = measurementsByMonth.get(key);
    if (!existing || m.date > existing.date) {
      measurementsByMonth.set(key, m);
    }
  }

  // ── Determine current month (skip it) ───────────────────────────────────

  const currentMonthKey = toYearMonth(new Date().toISOString());
  const allMonthKeys = Array.from(
    new Set([...workoutsByMonth.keys(), ...measurementsByMonth.keys()]),
  ).filter((k) => k < currentMonthKey).sort();

  console.log(`\nFound ${allMonthKeys.length} historical months to consider (excluding current month).`);

  // ── Process each month ───────────────────────────────────────────────────

  let created = 0;
  let skipped = 0;

  for (const monthKey of allMonthKeys) {
    const { year, month, nextYear, nextMonth } = parseMonthKey(monthKey);
    const rangeStart = `${year}-${pad2(month)}-01`;
    const rangeEnd = `${nextYear}-${pad2(nextMonth)}-01`;

    // Check for existing Hevy readings in this month
    const existing = await db
      .select({ id: lifeMetricReadings.id })
      .from(lifeMetricReadings)
      .innerJoin(snapshots, eq(lifeMetricReadings.snapshotId, snapshots.id))
      .where(
        and(
          gte(snapshots.takenAt, rangeStart),
          lt(snapshots.takenAt, rangeEnd),
          inArray(lifeMetricReadings.metricId, hevyMetricIds),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const monthWorkouts = workoutsByMonth.get(monthKey) ?? [];

    // Only skip if there's truly nothing to record
    if (monthWorkouts.length === 0 && !measurementsByMonth.has(monthKey)) {
      skipped++;
      continue;
    }

    // Compute Hevy metrics for this month
    const sessionCount = monthWorkouts.length;
    const volumeKg = monthWorkouts.reduce((total, w) => {
      return (
        total +
        w.exercises.reduce((exTotal, ex) => {
          return (
            exTotal +
            ex.sets.reduce((setTotal, s) => {
              if (s.weight_kg != null && s.reps != null) {
                return setTotal + s.weight_kg * s.reps;
              }
              return setTotal;
            }, 0)
          );
        }, 0)
      );
    }, 0);

    console.log(
      `Processing ${monthKey}: ${sessionCount} workout(s), volume ${Math.round(volumeKg)} kg`,
    );

    const takenAt = lastMomentOfMonth(year, month);
    const snapshotId = randomUUID();

    // Insert snapshot
    await db.insert(snapshots).values({
      id: snapshotId,
      takenAt,
      isPartial: true,
      notes: `Hevy historical backfill for ${monthKey}`,
    });

    // Build readings
    const readings: {
      id: string;
      snapshotId: string;
      metricId: string;
      value: number;
    }[] = [];

    if (workoutSessionsMetric) {
      readings.push({
        id: randomUUID(),
        snapshotId,
        metricId: workoutSessionsMetric.id,
        value: sessionCount,
      });
    }

    if (trainingVolumeMetric) {
      readings.push({
        id: randomUUID(),
        snapshotId,
        metricId: trainingVolumeMetric.id,
        value: Math.round(volumeKg),
      });
    }

    if (personalRecordsMetric) {
      readings.push({
        id: randomUUID(),
        snapshotId,
        metricId: personalRecordsMetric.id,
        value: 0,
      });
    }

    // Body weight reading
    const measurement = measurementsByMonth.get(monthKey);
    if (bodyWeightMetric && measurement?.weight_kg != null) {
      readings.push({
        id: randomUUID(),
        snapshotId,
        metricId: bodyWeightMetric.id,
        value: measurement.weight_kg,
      });
    }

    if (readings.length > 0) {
      await db.insert(lifeMetricReadings).values(readings);
    }

    created++;
  }

  console.log(`\nDone! Created ${created} snapshot(s), skipped ${skipped} month(s).`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
