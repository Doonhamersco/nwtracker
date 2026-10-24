"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChangeIndicator } from "@/components/ui/ChangeIndicator";
import { Sparkline } from "@/components/metrics/Sparkline";
import {
  formatSignedPercent,
  levelStat,
  rollingChange,
  sliceByTimeframe,
  type ChangeStat,
  type LevelStat,
  type SeriesPoint,
  type Timeframe,
} from "@/lib/dashboard-kpis";

interface KpiStripProps {
  points: SeriesPoint[];
  timeframe: Timeframe;
  hideDebt: boolean;
  monthlySubscriptionGbp: number;
  activeSubscriptionCount: number;
}

function formatGbp(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function ChangeTile({ label, stat }: { label: string; stat: ChangeStat }) {
  const variant =
    stat.delta === null ? "neutral" : stat.delta >= 0 ? "positive" : "negative";
  const color =
    stat.delta !== null && stat.delta < 0 ? "var(--nw-negative)" : "var(--nw-positive)";

  return (
    <Card variant="inset" padding="compact" className="flex h-full min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
          {label}
        </span>
        <Badge variant={variant}>
          {stat.percent === null ? "—" : formatSignedPercent(stat.percent)}
        </Badge>
      </div>
      {stat.delta === null ? (
        <span className="font-mono text-sm text-muted">—</span>
      ) : (
        <ChangeIndicator change={stat.delta} percent={null} className="text-xs sm:text-sm" />
      )}
      <div className="h-8 w-full min-w-0">
        <Sparkline
          data={stat.spark.length > 0 ? stat.spark : [0, 0]}
          color={stat.spark.length > 0 ? color : "var(--nw-placeholder)"}
          height={32}
        />
      </div>
    </Card>
  );
}

function LevelTile({
  label,
  stat,
  downIsGood = false,
  suffix,
  badge,
  sparkColor,
  className,
  digits = 0,
}: {
  label: string;
  stat: LevelStat;
  downIsGood?: boolean;
  suffix?: string;
  badge?: React.ReactNode;
  sparkColor?: string;
  className?: string;
  digits?: number;
}) {
  const improved =
    stat.delta === null ? null : downIsGood ? stat.delta <= 0 : stat.delta >= 0;
  const variant = improved === null || stat.delta === 0 ? "neutral" : improved ? "positive" : "negative";
  const color =
    sparkColor ??
    (improved === null || improved ? "var(--nw-positive)" : "var(--nw-negative)");
  const cleared = downIsGood && stat.latest === 0;

  return (
    <Card variant="inset" padding="compact" className={`flex h-full min-w-0 flex-col gap-1.5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
          {label}
        </span>
        {badge ?? (
          <Badge variant={cleared ? "positive" : variant}>
            {cleared ? "Clear" : stat.percent === null ? "—" : formatSignedPercent(stat.percent)}
          </Badge>
        )}
      </div>
      <p className="font-mono text-sm tabular-nums text-text sm:text-base">
        {stat.latest === null ? "—" : formatGbp(stat.latest, digits)}
        {suffix && stat.latest !== null && (
          <span className="ml-1 text-[11px] font-sans text-muted">{suffix}</span>
        )}
      </p>
      <div className="h-8 w-full min-w-0">
        <Sparkline
          data={stat.spark.length > 0 ? stat.spark : [0, 0]}
          color={stat.spark.length > 0 ? color : "var(--nw-placeholder)"}
          height={32}
        />
      </div>
    </Card>
  );
}

export function KpiStrip({
  points,
  timeframe,
  hideDebt,
  monthlySubscriptionGbp,
  activeSubscriptionCount,
}: KpiStripProps) {
  const month = rollingChange(points, hideDebt, 30, 21);
  const year = rollingChange(points, hideDebt, 365, 46);
  const windowed = sliceByTimeframe(points, timeframe);
  const assets = levelStat(windowed.map((point) => point.assetsGbp));
  const debt = levelStat(windowed.map((point) => point.debtGbp));
  const subscriptions: LevelStat = {
    latest: monthlySubscriptionGbp,
    delta: null,
    percent: null,
    spark: [monthlySubscriptionGbp, monthlySubscriptionGbp],
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      <ChangeTile label="This month" stat={month} />
      <ChangeTile label="Past year" stat={year} />
      <LevelTile label="Assets" stat={assets} />
      <LevelTile label="Debt" stat={debt} downIsGood />
      <LevelTile
        label="Subscriptions"
        stat={subscriptions}
        suffix="/mo"
        digits={2}
        sparkColor="var(--nw-muted)"
        className="col-span-2 sm:col-span-1"
        badge={
          <Badge variant="neutral">
            {activeSubscriptionCount === 1
              ? "1 active"
              : `${activeSubscriptionCount} active`}
          </Badge>
        }
      />
    </div>
  );
}
