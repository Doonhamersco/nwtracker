"use client";

import { useCallback, useId, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAccentColor } from "@/components/layout/ProfileProvider";
import { paletteFromAccent } from "@/lib/profile-theme";
import { timeframeCutoff, type AccountMove, type Timeframe } from "@/lib/dashboard-kpis";
import { useDashboardPrefs } from "./useDashboardPrefs";
import { ChartTooltip } from "./chart/ChartTooltip";
import { clusterEvents } from "./chart/clusterEvents";
import { EventLabel } from "./chart/EventMarkers";
import { formatAxisGbp } from "./chart/format";
import type { ChartDataPoint, NotableEvent, SeriesKey, WeightReading } from "./chart/types";
import { WeightChart } from "./chart/WeightChart";

export type { NotableEvent, WeightReading };

interface SnapshotSummary {
  id: string;
  takenAt: string;
  netWorthGbp: number | null;
  isPartial: boolean;
  notes: string | null;
}

interface NetWorthChartProps {
  snapshots: SnapshotSummary[];
  timeframe: Timeframe;
  loading: boolean;
  events?: NotableEvent[];
  weightReadings?: WeightReading[];
  movesByDate?: Record<string, AccountMove[]>;
  hideDebt?: boolean;
  variant?: "default" | "hero";
}

const WEIGHT_COLOR = "#8a9bb0";
const LEFT_AXIS = 56;
const RIGHT_AXIS = 44;
const SYNC_ID = "nw-dashboard";

export function NetWorthChart({
  snapshots,
  timeframe,
  loading,
  events = [],
  weightReadings = [],
  movesByDate = {},
  hideDebt = false,
  variant = "default",
}: NetWorthChartProps) {
  const accentColor = useAccentColor();
  const palette = paletteFromAccent(accentColor);
  const gradientId = useId().replace(/:/g, "");
  const { showEvents, setShowEvents } = useDashboardPrefs();
  const [visible, setVisible] = useState<Set<SeriesKey>>(new Set(["netWorth"]));
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const handleEnter = useCallback((id: string) => setActiveClusterId(id), []);
  const handleLeave = useCallback(() => setActiveClusterId(null), []);
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(() => setContainerWidth(node.clientWidth));
    observer.observe(node);
    setContainerWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  function toggleSeries(key: SeriesKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  const cutoff = timeframeCutoff(timeframe);
  const dateMap = new Map<string, { netWorth: number | null; weight: number | null }>();

  const netWorthSnapshots = snapshots
    .filter((snapshot) => snapshot.netWorthGbp !== null && (!cutoff || new Date(snapshot.takenAt) >= cutoff))
    .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

  for (const snapshot of netWorthSnapshots) {
    const iso = snapshot.takenAt.slice(0, 10);
    const existing = dateMap.get(iso) ?? { netWorth: null, weight: null };
    dateMap.set(iso, { ...existing, netWorth: snapshot.netWorthGbp });
  }

  const filteredWeight = weightReadings.filter((reading) => !cutoff || new Date(reading.date) >= cutoff);
  for (const reading of filteredWeight) {
    const existing = dateMap.get(reading.date) ?? { netWorth: null, weight: null };
    dateMap.set(reading.date, { ...existing, weight: reading.weightKg });
  }

  if (dateMap.size === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <p className="text-sm text-muted">No snapshot data yet</p>
      </div>
    );
  }

  const sortedIso = [...dateMap.keys()].sort();
  const manyPoints = sortedIso.length > 12;
  const chartData: ChartDataPoint[] = [];
  let prevNetWorth: number | undefined;
  let prevTs: number | undefined;

  for (const iso of sortedIso) {
    const { netWorth, weight } = dateMap.get(iso)!;
    const date = new Date(`${iso}T12:00:00`);
    const point: ChartDataPoint = {
      ts: date.getTime(),
      date: date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: manyPoints ? "2-digit" : "numeric",
      }),
      isoDate: iso,
      value: netWorth,
      prev: prevNetWorth,
      prevTs,
      weight,
      moves: movesByDate[iso] ?? [],
    };
    chartData.push(point);
    if (netWorth !== null) {
      prevNetWorth = netWorth;
      prevTs = point.ts;
    }
  }

  const values = chartData.flatMap((point) => (point.value === null ? [] : [point.value]));
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const showZeroLine = minValue <= 0;
  const showNetWorth = visible.has("netWorth");
  const showWeight = visible.has("weight");
  const hasWeightData = showWeight && chartData.some((point) => point.weight !== null);
  const rightReserve = hasWeightData ? RIGHT_AXIS : 8;
  const isHero = variant === "hero";
  const domainMin = chartData[0]?.ts ?? 0;
  const domainMax = chartData[chartData.length - 1]?.ts ?? 0;
  const plotWidth = Math.max(0, containerWidth - LEFT_AXIS - rightReserve);

  const visibleEvents = showEvents
    ? events.filter((event) => !cutoff || new Date(event.date) >= cutoff)
    : [];
  const clusters = clusterEvents(
    visibleEvents.map((event) => ({
      ...event,
      xValue: new Date(`${event.date}T12:00:00`).getTime(),
    })),
    [domainMin, domainMax],
    plotWidth
  );

  const series = [
    { key: "netWorth" as const, label: "Net worth", color: accentColor },
    { key: "weight" as const, label: "Weight", color: WEIGHT_COLOR },
  ];
  const chrome = {
    card: palette.bgCard,
    muted: palette.muted,
    border: palette.border,
    text: "#e8eef6",
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {series.map((item) => {
          const on = visible.has(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleSeries(item.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                on
                  ? "border"
                  : "border border-border-strong bg-transparent text-placeholder hover:border-muted hover:text-muted"
              }`}
              style={
                on
                  ? {
                      backgroundColor: `${item.color}18`,
                      borderColor: `${item.color}80`,
                      color: item.color,
                    }
                  : undefined
              }
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: on ? item.color : "#64748b" }}
              />
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={showEvents}
          onClick={() => setShowEvents((current) => !current)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            showEvents
              ? "border"
              : "border border-border-strong bg-transparent text-placeholder hover:border-muted hover:text-muted"
          }`}
          style={
            showEvents
              ? {
                  backgroundColor: `${accentColor}18`,
                  borderColor: `${accentColor}80`,
                  color: accentColor,
                }
              : undefined
          }
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: showEvents ? accentColor : "#64748b" }}
          />
          Events
        </button>
      </div>

      <div
        ref={measure}
        className={`w-full min-w-0 ${isHero ? "h-72 sm:h-80 lg:h-[22rem]" : "h-52 sm:h-64"}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            syncId={SYNC_ID}
            margin={{ top: 8, right: rightReserve, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity={0.55} />
                <stop offset="50%" stopColor={accentColor} stopOpacity={0.16} />
                <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.border} vertical={false} />
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
              tick={{ fill: palette.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              width={LEFT_AXIS}
              tickFormatter={formatAxisGbp}
              tick={{ fill: showNetWorth ? palette.muted : "transparent", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={
                <ChartTooltip visible={visible} hideDebt={hideDebt} />
              }
            />
            {showZeroLine && (
              <ReferenceLine
                y={0}
                yAxisId="left"
                stroke={palette.muted}
                strokeDasharray="4 4"
                strokeOpacity={0.8}
                ifOverflow="hidden"
              />
            )}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="value"
              stroke={showNetWorth ? accentColor : "transparent"}
              strokeWidth={2}
              fill={showNetWorth ? `url(#${gradientId})` : "transparent"}
              baseValue={showZeroLine ? 0 : undefined}
              isAnimationActive={false}
              dot={false}
              activeDot={
                showNetWorth
                  ? { r: 4, fill: accentColor, stroke: palette.bgCard, strokeWidth: 2 }
                  : false
              }
              connectNulls
            />
            {clusters.map((cluster) => (
              <ReferenceLine
                key={cluster.id}
                x={cluster.xValue}
                yAxisId="left"
                stroke="transparent"
                ifOverflow="hidden"
                label={(props: { viewBox?: { x?: number; y?: number; height?: number } }) => (
                  <EventLabel
                    viewBox={props.viewBox}
                    cluster={cluster}
                    activeClusterId={activeClusterId}
                    accentColor={accentColor}
                    chartWidth={containerWidth}
                    chrome={chrome}
                    onEnter={handleEnter}
                    onLeave={handleLeave}
                  />
                )}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {hasWeightData && (
        <div className="mt-2">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-weight">
            Weight
          </p>
          <div className="h-20 w-full min-w-0">
            <WeightChart
              data={chartData}
              syncId={SYNC_ID}
              color={WEIGHT_COLOR}
              axisColor={WEIGHT_COLOR}
              leftAxis={LEFT_AXIS}
              rightAxis={RIGHT_AXIS}
            />
          </div>
        </div>
      )}
    </div>
  );
}
