import { cn } from "@/lib/utils";

interface NumberDisplayProps {
  value: number;
  prefix?: string;
  decimals?: number;
  large?: boolean;
  className?: string;
}

export function NumberDisplay({
  value,
  prefix = "£",
  decimals = 0,
  large = false,
  className,
}: NumberDisplayProps) {
  const formatted = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));

  const isNegative = value < 0;

  return (
    <span
      className={cn(
        "tabular-nums",
        isNegative ? "text-negative" : "text-text",
        large
          ? "whitespace-nowrap font-display font-medium text-5xl sm:text-6xl lg:text-7xl tracking-tight"
          : "font-mono",
        className
      )}
    >
      {isNegative ? "-" : ""}
      {prefix}
      {formatted}
    </span>
  );
}
