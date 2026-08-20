import { randomUUID } from "crypto";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { lifeMetricReadings, lifeMetricDefinitions, snapshots } from "@/db/schema";

export interface WeightReading {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  snapshotId: string;
}

function getBodyWeightMetricId(): string | null {
  const [def] = db
    .select({ id: lifeMetricDefinitions.id })
    .from(lifeMetricDefinitions)
    .where(eq(lifeMetricDefinitions.name, "Body Weight"))
    .all();
  return def?.id ?? null;
}

export function listWeightReadings(): WeightReading[] {
  const metricId = getBodyWeightMetricId();
  if (!metricId) return [];

  return db
    .select({
      id: lifeMetricReadings.id,
      snapshotId: lifeMetricReadings.snapshotId,
      value: lifeMetricReadings.value,
      takenAt: snapshots.takenAt,
    })
    .from(lifeMetricReadings)
    .innerJoin(snapshots, eq(lifeMetricReadings.snapshotId, snapshots.id))
    .where(eq(lifeMetricReadings.metricId, metricId))
    .orderBy(asc(snapshots.takenAt))
    .all()
    .map((r) => ({
      id: r.id,
      date: r.takenAt.slice(0, 10),
      weightKg: r.value,
      snapshotId: r.snapshotId,
    }));
}

export function createWeightReading(date: string, weightKg: number): WeightReading {
  // Ensure Body Weight metric definition exists
  let metricId = getBodyWeightMetricId();
  if (!metricId) {
    metricId = randomUUID();
    db.insert(lifeMetricDefinitions)
      .values({
        id: metricId,
        name: "Body Weight",
        unit: "kg",
        displayColor: "#6366f1",
        isBuiltin: true,
        sortOrder: 0,
      })
      .run();
  }

  // Find existing snapshot on this date
  const dayStart = `${date} 00:00:00`;
  const dayEnd = `${date} 23:59:59`;
  const existing = db
    .select()
    .from(snapshots)
    .where(and(gte(snapshots.takenAt, dayStart), lte(snapshots.takenAt, dayEnd)))
    .all();

  let snapshotId: string;
  if (existing.length > 0) {
    snapshotId = existing[0].id;
  } else {
    snapshotId = randomUUID();
    db.insert(snapshots)
      .values({ id: snapshotId, takenAt: `${date} 12:00:00`, isPartial: true })
      .run();
  }

  // Upsert the reading (one reading per metric per snapshot)
  const [existingReading] = db
    .select()
    .from(lifeMetricReadings)
    .where(
      and(
        eq(lifeMetricReadings.snapshotId, snapshotId),
        eq(lifeMetricReadings.metricId, metricId)
      )
    )
    .all();

  if (existingReading) {
    db.update(lifeMetricReadings)
      .set({ value: weightKg })
      .where(eq(lifeMetricReadings.id, existingReading.id))
      .run();
    return { id: existingReading.id, date, weightKg, snapshotId };
  }

  const readingId = randomUUID();
  db.insert(lifeMetricReadings)
    .values({ id: readingId, snapshotId, metricId, value: weightKg })
    .run();

  return { id: readingId, date, weightKg, snapshotId };
}

export function deleteWeightReading(id: string): void {
  db.delete(lifeMetricReadings).where(eq(lifeMetricReadings.id, id)).run();
}
