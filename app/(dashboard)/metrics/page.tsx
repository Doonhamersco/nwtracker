import { getSnapshotHistory, getSnapshotById } from "@/lib/services/checkin"
import { db } from "@/db/client"
import { lifeMetricDefinitions } from "@/db/schema"
import { MetricsClient } from "./MetricsClient"

export default async function MetricsPage() {
  // Fetch last 12 committed snapshots
  const snapshots = getSnapshotHistory(12)

  // Fetch all metric definitions
  const metricDefs = db
    .select()
    .from(lifeMetricDefinitions)
    .orderBy(lifeMetricDefinitions.sortOrder)
    .all()

  // Fetch full details for each snapshot (metrics readings)
  const snapshotDetails = snapshots.map((s) => getSnapshotById(s.id)).filter(Boolean)

  // Build per-metric history: { [metricId]: number[] } oldest→newest
  const metricHistoryMap: Record<string, number[]> = {}
  for (const def of metricDefs) {
    metricHistoryMap[def.id] = []
  }

  // snapshotDetails is newest→oldest (from getSnapshotHistory desc), reverse for history
  const orderedDetails = [...snapshotDetails].reverse()
  for (const detail of orderedDetails) {
    if (!detail) continue
    for (const reading of detail.metrics) {
      if (metricHistoryMap[reading.metricId] !== undefined) {
        metricHistoryMap[reading.metricId].push(reading.value)
      }
    }
  }

  // Build snapshot history table rows (newest first)
  const historyRows = snapshotDetails.map((detail) => {
    if (!detail) return null
    const readingMap: Record<string, number> = {}
    for (const r of detail.metrics) {
      readingMap[r.metricId] = r.value
    }
    return {
      id: detail.snapshot.id,
      takenAt: detail.snapshot.takenAt,
      readings: readingMap,
    }
  }).filter(Boolean) as Array<{ id: string; takenAt: string; readings: Record<string, number> }>

  return (
    <MetricsClient
      metricDefs={metricDefs}
      metricHistoryMap={metricHistoryMap}
      historyRows={historyRows}
    />
  )
}
