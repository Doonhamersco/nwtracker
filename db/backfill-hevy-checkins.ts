/**
 * Attach rolling 30-day Hevy stats to existing monthly check-ins that are
 * missing workout metrics. Does not create new snapshots.
 *
 * Usage: npx tsx db/backfill-hevy-checkins.ts
 */

import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { lifeMetricDefinitions, lifeMetricReadings, snapshots } from "./schema";
import { hevyClient } from "../lib/hevy/client";
import { hevyMetricsAsOf } from "../lib/hevy/metrics";

if (!process.env.HEVY_API_KEY) {
  console.log("HEVY_API_KEY is not set — nothing to backfill. Exiting.");
  process.exit(0);
}

async function main() {
  const hevyMetrics = db
    .select()
    .from(lifeMetricDefinitions)
    .where(eq(lifeMetricDefinitions.isHevyMetric, true))
    .all();

  if (hevyMetrics.length === 0) {
    console.log("No Hevy metric definitions found. Exiting.");
    process.exit(0);
  }

  const sessionsMetric = hevyMetrics.find((m) => m.name.includes("Workout Sessions"));
  const volumeMetric = hevyMetrics.find((m) => m.name.includes("Training Volume"));
  const prMetric = hevyMetrics.find((m) => m.name.includes("Personal Records"));
  const hevyMetricIds = hevyMetrics.map((m) => m.id);

  const checkins = db
    .select()
    .from(snapshots)
    .where(eq(snapshots.isPartial, false))
    .all()
    .filter((s) => !s.notes?.startsWith("Historical backfill"));

  if (checkins.length === 0) {
    console.log("No monthly check-ins found.");
    return;
  }

  console.log(`Found ${checkins.length} monthly check-in(s). Fetching Hevy workouts…`);
  const workouts = await hevyClient.getAllWorkouts();
  console.log(`  → ${workouts.length} workouts fetched.`);

  let updated = 0;
  let skipped = 0;

  for (const snapshot of checkins.sort((a, b) => a.takenAt.localeCompare(b.takenAt))) {
    const existing = db
      .select({ id: lifeMetricReadings.id })
      .from(lifeMetricReadings)
      .where(
        and(
          eq(lifeMetricReadings.snapshotId, snapshot.id),
          inArray(lifeMetricReadings.metricId, hevyMetricIds),
        ),
      )
      .limit(1)
      .all();

    if (existing.length > 0) {
      console.log(`  skip ${snapshot.takenAt} — already has Hevy readings`);
      skipped++;
      continue;
    }

    const asOf = new Date(snapshot.takenAt.includes("T") ? snapshot.takenAt : snapshot.takenAt.replace(" ", "T"));
    const { sessions, volumeKg } = hevyMetricsAsOf(workouts, asOf);

    const readings: Array<{ id: string; snapshotId: string; metricId: string; value: number }> = [];
    if (sessionsMetric) {
      readings.push({
        id: randomUUID(),
        snapshotId: snapshot.id,
        metricId: sessionsMetric.id,
        value: sessions,
      });
    }
    if (volumeMetric) {
      readings.push({
        id: randomUUID(),
        snapshotId: snapshot.id,
        metricId: volumeMetric.id,
        value: volumeKg,
      });
    }
    if (prMetric) {
      readings.push({
        id: randomUUID(),
        snapshotId: snapshot.id,
        metricId: prMetric.id,
        value: 0,
      });
    }

    if (readings.length > 0) {
      db.insert(lifeMetricReadings).values(readings).run();
    }

    console.log(
      `  fill ${snapshot.takenAt}: ${sessions} sessions, ${volumeKg} kg`,
    );
    updated++;
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped}.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
