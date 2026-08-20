import { Skeleton } from "@/components/ui/Skeleton";
import { NumberDisplay } from "@/components/ui/NumberDisplay";

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
  label = "Net worth",
}: HeroTotalProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  const change =
    netWorthGbp !== null && previousGbp !== null
      ? netWorthGbp - previousGbp
      : null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
        {label}
      </span>
      {netWorthGbp !== null ? (
        <NumberDisplay value={netWorthGbp} large />
      ) : (
        <span className="font-display text-5xl text-muted">No data yet</span>
      )}
      {change !== null && (
        <p className={`text-sm ${change >= 0 ? "text-accent" : "text-negative"}`}>
          {change >= 0 ? "+" : "−"}£
          {Math.abs(change).toLocaleString("en-GB", { maximumFractionDigits: 0 })}{" "}
          since last snapshot
        </p>
      )}
    </div>
  );
}
