"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartDataPoint } from "./types";

interface WeightChartProps {
  data: ChartDataPoint[];
  syncId: string;
  color: string;
  axisColor: string;
  leftAxis: number;
  rightAxis: number;
}

export function WeightChart({
  data,
  syncId,
  color,
  axisColor,
  leftAxis,
  rightAxis,
}: WeightChartProps) {
  const weights = data.flatMap((point) => (point.weight === null ? [] : [point.weight]));
  const low = weights.length > 0 ? Math.min(...weights) : 0;
  const high = weights.length > 0 ? Math.max(...weights) : 1;
  const pad = Math.max(0.4, (high - low) * 0.25);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        syncId={syncId}
        margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
      >
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          hide
        />
        <YAxis
          yAxisId="spacer"
          orientation="left"
          width={leftAxis}
          tick={false}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="weight"
          orientation="right"
          width={rightAxis}
          tickFormatter={(value: number) => `${value}`}
          tick={{ fill: axisColor, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          domain={[Math.floor((low - pad) * 10) / 10, Math.ceil((high + pad) * 10) / 10]}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const point = payload[0]?.payload as ChartDataPoint | undefined;
            if (!point || point.weight === null) return null;
            return (
              <div className="rounded-lg border border-border bg-bg-card px-2.5 py-1.5 text-xs text-weight">
                {point.weight.toFixed(1)} kg
              </div>
            );
          }}
        />
        <Line
          yAxisId="weight"
          type="monotone"
          dataKey="weight"
          stroke={color}
          strokeWidth={1.75}
          dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 4, fill: color }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
