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
        "font-mono tabular-nums",
        isNegative ? "text-[#EF4444]" : "text-[#F1F5F9]",
        large && "font-bold text-4xl md:text-5xl",
        className
      )}
    >
      {isNegative ? "-" : ""}
      {prefix}
      {formatted}
    </span>
  );
}
