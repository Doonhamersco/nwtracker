"use client";

import { useState, useCallback } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Timeframe } from "./TimeframeSelector";

interface SnapshotSummary {
  id: string;
  takenAt: string;
  netWorthGbp: number | null;
  isPartial: boolean;
  notes: string | null;
}

export interface NotableEvent {
  id: string;
  date: string;
  emoji: string;
  label: string;
}

export interface WeightReading {
  id: string;
  date: string;
  weightKg: number;
  snapshotId: string;
}

interface NetWorthChartProps {
  snapshots: SnapshotSummary[];
  timeframe: Timeframe;
  loading: boolean;
  events?: NotableEvent[];
  weightReadings?: WeightReading[];
}

// ─── Series config ────────────────────────────────────────────────────────────
// To add a new series in the future, add an entry here.

const SERIES = [
  { key: "netWorth", label: "Net Worth", color: "#22c55e" },
  { key: "weight",   label: "Weight (kg)", color: "#6366f1" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeframeCutoff(timeframe: Timeframe): Date | null {
  const now = new Date();
  switch (timeframe) {
    case "1M": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3M": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "6M": return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case "1Y": return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case "ALL": return null;
  }
}

function formatGbp(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `£${(value / 1_000).toFixed(0)}k`;
  return `£${value.toFixed(0)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartDataPoint {
  ts: number;
  date: string;
  isoDate: string;
  value: number | null;
  prev?: number;
  weight: number | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number | null; dataKey: string; payload: ChartDataPoint }>;
  label?: string;
  visible: Set<SeriesKey>;
}

function CustomTooltip({ active, payload, label, visible }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const current = point.value;
  const prev = point.prev;
  const change = current !== null && prev !== undefined ? current - prev : null;
  const displayLabel = point.date ?? label;

  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-[#94A3B8] mb-1">{displayLabel}</p>
      {visible.has("netWorth") && current !== null && (
        <>
          <p className="text-base font-bold text-[#F1F5F9]">
            {new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: "GBP",
              maximumFractionDigits: 0,
            }).format(current)}
          </p>
          {change !== null && (
            <p className={`text-xs mt-0.5 ${change >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
              {change >= 0 ? "▲" : "▼"} £
              {Math.abs(change).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </p>
          )}
        </>
      )}
      {visible.has("weight") && point.weight !== null && (
        <p className="text-xs text-[#6366f1] mt-1 font-mono">⚖ {point.weight.toFixed(1)} kg</p>
      )}
    </div>
  );
}

// ─── Event label ──────────────────────────────────────────────────────────────

interface EventLabelProps {
  viewBox?: { x?: number; y?: number; height?: number };
  emoji: string;
  label: string;
  eventId: string;
  activeEventId: string | null;
  onEnter: (id: string) => void;
  onLeave: () => void;
}

function EventLabel({ viewBox, emoji, label, eventId, activeEventId, onEnter, onLeave }: EventLabelProps) {
  const x = viewBox?.x ?? 0;
  const chartHeight = viewBox?.height ?? 0;
  const isActive = activeEventId === eventId;
  const markerY = chartHeight - 8;
  const tooltipWidth = Math.min(label.length * 7 + 24, 200);
  const tooltipHeight = 36;
  const tooltipX = x - tooltipWidth / 2;
  const tooltipY = markerY - tooltipHeight - 8;

  return (
    <g>
      <line x1={x} y1={0} x2={x} y2={markerY - 14} stroke="#4B5563" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      <circle
        cx={x} cy={markerY} r={12}
        fill="#1C1C1E"
        stroke={isActive ? "#F1F5F9" : "#374151"}
        strokeWidth={1.5}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onEnter(eventId)}
        onMouseLeave={onLeave}
      />
      <text x={x} y={markerY + 4} textAnchor="middle" fontSize={11} style={{ cursor: "pointer", userSelect: "none" }} onMouseEnter={() => onEnter(eventId)} onMouseLeave={onLeave}>
        {emoji}
      </text>
      {isActive && (
        <g>
          <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx={6} fill="#111111" stroke="#333333" strokeWidth={1} filter="drop-shadow(0 2px 8px rgba(0,0,0,0.6))" />
          <text x={x} y={tooltipY + tooltipHeight / 2 + 5} textAnchor="middle" fontSize={11} fill="#F1F5F9" fontFamily="system-ui, sans-serif">
            {emoji} {label.length > 22 ? label.slice(0, 22) + "…" : label}
          </text>
        </g>
      )}
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NetWorthChart({
  snapshots,
  timeframe,
  loading,
  events = [],
  weightReadings = [],
}: NetWorthChartProps) {
  const [visible, setVisible] = useState<Set<SeriesKey>>(new Set(["netWorth"]));
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  const handleEnter = useCallback((id: string) => setActiveEventId(id), []);
  const handleLeave = useCallback(() => setActiveEventId(null), []);

  function toggleSeries(key: SeriesKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (loading) return <Skeleton className="w-full h-64" />;

  const cutoff = getTimeframeCutoff(timeframe);

  const dateMap = new Map<string, { netWorth: number | null; weight: number | null }>();

  // Always collect net worth data (drives the date axis even when hidden)
  const netWorthSnapshots = snapshots
    .filter((s) => s.netWorthGbp !== null && (!cutoff || new Date(s.takenAt) >= cutoff))
    .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

  for (const s of netWorthSnapshots) {
    const iso = s.takenAt.slice(0, 10);
    const existing = dateMap.get(iso) ?? { netWorth: null, weight: null };
    dateMap.set(iso, { ...existing, netWorth: s.netWorthGbp });
  }

  // Always collect weight data (so toggling on doesn't require re-fetch)
  const filteredWeight = weightReadings.filter((w) => !cutoff || new Date(w.date) >= cutoff);
  for (const w of filteredWeight) {
    const existing = dateMap.get(w.date) ?? { netWorth: null, weight: null };
    dateMap.set(w.date, { ...existing, weight: w.weightKg });
  }

  if (dateMap.size === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <p className="text-[#94A3B8] text-sm">No snapshot data yet</p>
      </div>
    );
  }

  const sortedIso = [...dateMap.keys()].sort();
  const manyPoints = sortedIso.length > 12;

  let prevNetWorth: number | undefined;
  const chartData: ChartDataPoint[] = sortedIso.map((iso) => {
    const { netWorth, weight } = dateMap.get(iso)!;
    const d = new Date(iso + "T12:00:00");
    const point: ChartDataPoint = {
      ts: d.getTime(),
      date: d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: manyPoints ? "2-digit" : "numeric",
      }),
      isoDate: iso,
      value: netWorth,
      prev: prevNetWorth,
      weight,
    };
    if (netWorth !== null) prevNetWorth = netWorth;
    return point;
  });

  const visibleEvents = events.filter((ev) => !cutoff || new Date(ev.date) >= cutoff);
  const eventReferenceLines = visibleEvents.map((ev) => ({
    ...ev,
    xValue: new Date(ev.date + "T12:00:00").getTime(),
  }));

  const showNetWorth = visible.has("netWorth");
  const showWeight = visible.has("weight");
  const hasWeightData = showWeight && chartData.some((d) => d.weight !== null);
  const rightMargin = hasWeightData ? 55 : 10;

  return (
    <div>
      {/* Series toggle pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {SERIES.map((s) => {
          const on = visible.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                on
                  ? "border"
                  : "bg-transparent border border-[#333333] text-[#4B5563] hover:border-[#555555] hover:text-[#94A3B8]"
              }`}
              style={
                on
                  ? {
                      backgroundColor: `${s.color}18`,
                      borderColor: `${s.color}80`,
                      color: s.color,
                    }
                  : undefined
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: on ? s.color : "#4B5563" }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={256}>
        <ComposedChart data={chartData} margin={{ top: 10, right: rightMargin, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ts: number) =>
              new Date(ts).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: manyPoints ? "2-digit" : "numeric",
              })
            }
            tick={{ fill: "#94A3B8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tickFormatter={formatGbp}
            tick={{ fill: showNetWorth ? "#94A3B8" : "transparent", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={showNetWorth ? 60 : 1}
          />
          {hasWeightData && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v: number) => `${v}kg`}
              tick={{ fill: "#6366f1", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={50}
              domain={["auto", "auto"]}
            />
          )}
          <Tooltip content={<CustomTooltip visible={visible} />} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="value"
            stroke={showNetWorth ? "#22c55e" : "transparent"}
            strokeWidth={2}
            fill={showNetWorth ? "url(#netWorthGradient)" : "transparent"}
            dot={false}
            activeDot={showNetWorth ? { r: 4, fill: "#22c55e", stroke: "#111111", strokeWidth: 2 } : false}
            connectNulls
          />
          {hasWeightData && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="weight"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3, fill: "#6366f1", stroke: "#111111", strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: "#6366f1", stroke: "#111111", strokeWidth: 2 }}
              connectNulls
            />
          )}
          {eventReferenceLines.map(
            (ev) =>
              ev.xValue && (
                <ReferenceLine
                  key={ev.id}
                  x={ev.xValue}
                  yAxisId="left"
                  stroke="transparent"
                  label={(props) => (
                    <EventLabel
                      {...props}
                      emoji={ev.emoji}
                      label={ev.label}
                      eventId={ev.id}
                      activeEventId={activeEventId}
                      onEnter={handleEnter}
                      onLeave={handleLeave}
                    />
                  )}
                />
              )
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
