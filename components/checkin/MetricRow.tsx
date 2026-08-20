"use client";

import { Badge } from "@/components/ui/Badge";

interface DraftMetricReading {
  metricId: string;
  metricName: string;
  unit: string;
  displayColor: string;
  isHevyMetric: boolean;
  lastValue: number | null;
}

interface MetricRowProps {
  metric: DraftMetricReading;
  value: number | null;
  onChange: (value: number | null) => void;
}

export function MetricRow({ metric, value, onChange }: MetricRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-bg-base border border-border hover:border-accent/40 transition-colors">
      {/* Colored dot + name */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: metric.displayColor }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text">
              {metric.metricName}
            </span>
            <span className="text-xs text-muted">{metric.unit}</span>
            {metric.isHevyMetric && (
              <Badge variant="accent">auto-synced from Hevy</Badge>
            )}
          </div>
          {metric.lastValue !== null && (
            <p className="text-xs text-muted mt-0.5">
              Last: {metric.lastValue} {metric.unit}
            </p>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="number"
          value={value ?? ""}
          step="0.01"
          readOnly={metric.isHevyMetric}
          onChange={(e) => {
            const num = e.target.value === "" ? null : parseFloat(e.target.value);
            onChange(num !== null && isNaN(num) ? null : num);
          }}
          placeholder={metric.lastValue !== null ? String(metric.lastValue) : "—"}
          className={`w-full min-h-11 rounded-lg border border-border bg-bg-card text-text text-sm font-mono px-3 py-2 focus:outline-none focus:border-accent transition-colors sm:w-28 ${metric.isHevyMetric ? "opacity-60 cursor-not-allowed" : ""}`}
        />
        <span className="text-xs text-muted w-10">{metric.unit}</span>
      </div>
    </div>
  );
}
