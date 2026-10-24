import { cn } from "@/lib/utils";

interface ChangeIndicatorProps {
  change: number | null;
  percent: number | null;
  className?: string;
}

export function ChangeIndicator({ change, percent, className }: ChangeIndicatorProps) {
  if (change === null) return null;

  const isPositive = change >= 0;
  const arrow = isPositive ? "▲" : "▼";
  const color = isPositive ? "text-positive" : "text-negative";

  const absChange = Math.abs(change);
  const formattedChange = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absChange);

  const percentStr =
    percent !== null
      ? ` (${isPositive ? "+" : "-"}${Math.abs(percent).toFixed(1)}%)`
      : "";

  return (
    <span className={cn("whitespace-nowrap text-sm font-medium", color, className)}>
      {arrow} £{formattedChange}
      {percentStr}
    </span>
  );
}
