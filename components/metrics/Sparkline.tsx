"use client"

import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts"

interface SparklineProps {
  data: number[]
  color: string
  width?: number
  height?: number
}

export function Sparkline({ data, color, width, height = 48 }: SparklineProps) {
  const chartData = data.length < 2
    ? [{ v: data[0] ?? 0 }, { v: data[0] ?? 0 }]
    : data.map((v) => ({ v }))

  return (
    <ResponsiveContainer width={width ?? "100%"} height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
