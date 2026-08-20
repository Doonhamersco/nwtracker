import { db } from "./client";
import { snapshots, lifeMetricReadings, lifeMetricDefinitions } from "./schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

const weightData: { date: string; weight: number; location?: string }[] = [
  // 2024
  { date: "2024-05-05", weight: 70.0 },
  { date: "2024-05-24", weight: 70.5 },
  { date: "2024-06-03", weight: 72.0 },
  { date: "2024-06-09", weight: 74.0 },
  { date: "2024-06-21", weight: 75.4 },
  { date: "2024-06-24", weight: 76.0,  location: "dg one" },
  { date: "2024-06-24", weight: 75.7,  location: "home" },
  { date: "2024-07-05", weight: 76.2,  location: "DG ONE" },
  { date: "2024-07-05", weight: 77.1,  location: "home" },
  { date: "2024-07-06", weight: 77.5,  location: "dg1 one" },
  { date: "2024-07-09", weight: 78.9,  location: "dg1" },
  { date: "2024-07-12", weight: 78.4,  location: "dg one" },
  { date: "2024-07-13", weight: 79.5,  location: "home" },
  { date: "2024-07-29", weight: 75.3,  location: "home" },
  { date: "2024-07-30", weight: 77.0,  location: "Dg one" },
  { date: "2024-08-12", weight: 76.0,  location: "dg one" },
  { date: "2024-09-01", weight: 76.5 },
  { date: "2024-10-13", weight: 73.0 },
  // 2025
  { date: "2025-04-05", weight: 80.0 },
  { date: "2025-04-28", weight: 77.0 },
  { date: "2025-05-10", weight: 79.8,  location: "thl" },
  { date: "2025-05-15", weight: 80.6 },
  { date: "2025-05-22", weight: 80.9 },
  { date: "2025-05-26", weight: 81.4 },
  { date: "2025-06-06", weight: 80.8 },
  { date: "2025-06-19", weight: 81.6 },
  { date: "2025-06-22", weight: 81.7 },
  { date: "2025-06-28", weight: 82.7 },
  { date: "2025-07-01", weight: 81.6 },
  { date: "2025-07-05", weight: 81.6 },
  { date: "2025-07-10", weight: 80.3 },
  { date: "2025-07-14", weight: 81.2 },
  { date: "2025-08-22", weight: 83.5 },
  { date: "2025-09-25", weight: 85.6 },
  // 2026
  { date: "2026-05-06", weight: 82.0 },
];

async function main() {
  // 1. Look up Body Weight metric definition
  const [metricDef] = await db
    .select()
    .from(lifeMetricDefinitions)
    .where(eq(lifeMetricDefinitions.name, "Body Weight"));

  if (!metricDef) {
    console.error("ERROR: 'Body Weight' metric definition not found in life_metric_definitions.");
    process.exit(1);
  }

  const metricId = metricDef.id;
  console.log(`Found 'Body Weight' metric definition: id=${metricId}`);
  console.log("");

  // Group entries by date so we can assign unique times for same-day entries
  const byDate = new Map<string, { weight: number; location?: string }[]>();
  for (const entry of weightData) {
    const list = byDate.get(entry.date) ?? [];
    list.push({ weight: entry.weight, location: entry.location });
    byDate.set(entry.date, list);
  }

  let inserted = 0;
  let skipped = 0;
  let newSnapshots = 0;
  let addedToExisting = 0;

  for (const [date, entries] of byDate) {
    const dayStart = `${date} 00:00:00`;
    const dayEnd = `${date} 23:59:59`;

    // Fetch all existing snapshots on this date
    const existingSnapshots = await db
      .select()
      .from(snapshots)
      .where(and(gte(snapshots.takenAt, dayStart), lte(snapshots.takenAt, dayEnd)));

    // Fetch all existing Body Weight readings on this date
    const existingReadings = existingSnapshots.length > 0
      ? await db
          .select()
          .from(lifeMetricReadings)
          .where(
            and(
              eq(lifeMetricReadings.metricId, metricId),
              inArray(
                lifeMetricReadings.snapshotId,
                existingSnapshots.map((s) => s.id)
              )
            )
          )
      : [];

    const existingValues = new Set(existingReadings.map((r) => r.value));

    // Track which snapshots already have a Body Weight reading (one reading per snapshot constraint)
    const snapshotsWithReading = new Set(existingReadings.map((r) => r.snapshotId));

    // Snapshots available to attach a new reading to (no Body Weight yet)
    const availableSnapshots = existingSnapshots.filter((s) => !snapshotsWithReading.has(s.id));

    let availableIdx = 0;

    for (const { weight, location } of entries) {
      // Idempotency: skip if this exact weight value already exists for this date
      if (existingValues.has(weight)) {
        console.log(`Skipped ${weight} kg on ${date} (already exists)`);
        skipped++;
        continue;
      }

      const notes = location ?? null;

      if (availableIdx < availableSnapshots.length) {
        // Attach to an existing snapshot that has no Body Weight reading yet
        const snapshot = availableSnapshots[availableIdx++];
        await db.insert(lifeMetricReadings).values({
          id: randomUUID(),
          snapshotId: snapshot.id,
          metricId,
          value: weight,
          notes,
        });
        console.log(`Inserted ${weight} kg on ${date}${location ? ` (${location})` : ""} → existing snapshot ${snapshot.id}`);
        existingValues.add(weight);
        inserted++;
        addedToExisting++;
      } else {
        // Create a new partial snapshot; offset time by 1 minute per additional same-day entry
        const takenAt = `${date} 12:${String(availableIdx).padStart(2, "0")}:00`;
        const snapshotId = randomUUID();
        await db.insert(snapshots).values({
          id: snapshotId,
          takenAt,
          isPartial: true,
        });

        await db.insert(lifeMetricReadings).values({
          id: randomUUID(),
          snapshotId,
          metricId,
          value: weight,
          notes,
        });

        console.log(`Inserted ${weight} kg on ${date}${location ? ` (${location})` : ""} → new partial snapshot ${snapshotId} at ${takenAt}`);
        existingValues.add(weight);
        inserted++;
        newSnapshots++;
        availableIdx++;
      }
    }
  }

  console.log("");
  console.log(
    `Done: ${inserted} inserted (${newSnapshots} new snapshots, ${addedToExisting} added to existing), ${skipped} skipped`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
