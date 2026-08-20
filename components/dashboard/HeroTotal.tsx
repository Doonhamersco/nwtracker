import { Skeleton } from "@/components/ui/Skeleton";
import { NumberDisplay } from "@/components/ui/NumberDisplay";
import { ChangeIndicator } from "@/components/ui/ChangeIndicator";

interface HeroTotalProps {
  netWorthGbp: number | null;
  previousGbp: number | null;
  loading: boolean;
  label?: string;
}

export function HeroTotal({
  netWorthGbp,
  previousGbp,
  loading,
  label = "Net Worth",
}: HeroTotalProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  const change =
    netWorthGbp !== null && previousGbp !== null
      ? netWorthGbp - previousGbp
      : null;
  const percent =
    change !== null && previousGbp !== null && previousGbp !== 0
      ? (change / previousGbp) * 100
      : null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-[#94A3B8] font-medium uppercase tracking-wide">
        {label}
      </span>
      {netWorthGbp !== null ? (
        <NumberDisplay value={netWorthGbp} large />
      ) : (
        <span className="text-4xl md:text-5xl font-bold text-[#94A3B8]">
          No data yet
        </span>
      )}
      {change !== null && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94A3B8]">vs last snapshot</span>
          <ChangeIndicator change={change} percent={percent} />
        </div>
      )}
    </div>
  );
}
