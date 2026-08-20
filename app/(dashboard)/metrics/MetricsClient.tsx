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
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-[#94A3B8] text-sm">No life metrics configured yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-[#F1F5F9] mb-6">Life Metrics</h1>

        {historyRows.length === 0 ? (
          <div className="text-[#94A3B8] text-sm">No metric data yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#222222]">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-[#222222] bg-[#111111]">
                  <th className="px-4 py-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider text-left">
                    Date
                  </th>
                  {metricDefs.map((m) => (
                    <th
                      key={m.id}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right"
                      style={{ color: m.displayColor }}
                    >
                      {m.name}
                      <span className="text-[#94A3B8] font-normal ml-1 normal-case">
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
                    className={`border-b border-[#222222] ${
                      i % 2 === 0 ? "bg-[#0a0a0a]" : "bg-[#111111]/50"
                    } hover:bg-[#1a1a1a] transition-colors`}
                  >
                    <td className="px-4 py-3 text-sm text-[#94A3B8]">
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
                            className={`font-mono text-sm ${isBelowGoal ? "text-red-400" : "text-[#F1F5F9]"}`}
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
