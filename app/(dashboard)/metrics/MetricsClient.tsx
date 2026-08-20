"use client";

const GYM_SESSION_GOAL = 12;

interface MetricDef {
  id: string;
  name: string;
  unit: string;
  displayColor: string;
  isHevyMetric: boolean;
  sortOrder: number;
}

interface HistoryRow {
  id: string;
  takenAt: string;
  readings: Record<string, number>;
}

interface MetricsClientProps {
  metricDefs: MetricDef[];
  metricHistoryMap: Record<string, number[]>;
  historyRows: HistoryRow[];
}

export function MetricsClient({ metricDefs, historyRows }: MetricsClientProps) {
  if (metricDefs.length === 0) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <p className="text-muted text-sm">No life metrics configured yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
        <h1 className="font-display text-3xl font-medium tracking-tight text-text mb-6">Life Metrics</h1>

        {historyRows.length === 0 ? (
          <div className="text-muted text-sm">No metric data yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-bg-card">
                  <th className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-left">
                    Date
                  </th>
                  {metricDefs.map((m) => (
                    <th
                      key={m.id}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right"
                      style={{ color: m.displayColor }}
                    >
                      {m.name}
                      <span className="text-muted font-normal ml-1 normal-case">
                        ({m.unit})
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-border ${
                      i % 2 === 0 ? "bg-bg-base" : "bg-bg-card/50"
                    } hover:bg-bg-hover transition-colors`}
                  >
                    <td className="px-4 py-3 text-sm text-muted">
                      {new Date(row.takenAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    {metricDefs.map((m) => {
                      const val = row.readings[m.id];
                      const isGymSessions = m.isHevyMetric && m.unit === "sessions";
                      const isBelowGoal = isGymSessions && val !== undefined && val < GYM_SESSION_GOAL;
                      return (
                        <td key={m.id} className="px-4 py-3 text-right">
                          <span
                            className={`font-mono text-sm ${isBelowGoal ? "text-negative" : "text-text"}`}
                          >
                            {val !== undefined
                              ? val.toLocaleString("en-GB", {
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
