import { eq } from "drizzle-orm";
import { FitnessClient } from "@/components/fitness/FitnessClient";
import { db } from "@/db/client";
import { lifeMetricDefinitions } from "@/db/schema";
import { getSnapshotById, getSnapshotHistory } from "@/lib/services/checkin";
import { listWeightReadings } from "@/lib/services/weight";

export const metadata = {
  title: "Fitness — nwTracker",
};

export default function FitnessPage() {
  const hevyDefs = db
    .select()
    .from(lifeMetricDefinitions)
    .where(eq(lifeMetricDefinitions.isHevyMetric, true))
    .orderBy(lifeMetricDefinitions.sortOrder)
    .all();

  const latest = getSnapshotHistory(12).find((snapshot) => !snapshot.isPartial) ?? null;
  const detail = latest ? getSnapshotById(latest.id) : null;
  const readingByMetric = new Map(detail?.metrics.map((reading) => [reading.metricId, reading.value]));

  const hevyMetrics = hevyDefs.map((def) => ({
    id: def.id,
    name: def.name,
    unit: def.unit,
    value: readingByMetric.get(def.id) ?? null,
  }));

  return (
    <FitnessClient initialWeightReadings={listWeightReadings()} hevyMetrics={hevyMetrics} />
  );
}
