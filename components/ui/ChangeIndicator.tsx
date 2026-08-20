interface ChangeIndicatorProps {
  change: number | null;
  percent: number | null;
}

export function ChangeIndicator({ change, percent }: ChangeIndicatorProps) {
  if (change === null) return null;

  const isPositive = change >= 0;
  const arrow = isPositive ? "▲" : "▼";
  const color = isPositive ? "text-[#22C55E]" : "text-[#EF4444]";

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
    <span className={`text-sm font-medium ${color}`}>
      {arrow} £{formattedChange}
      {percentStr}
    </span>
  );
}
