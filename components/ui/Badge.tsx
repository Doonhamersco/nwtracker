import { cn } from "@/lib/utils";

type Variant = "positive" | "negative" | "neutral" | "accent";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  positive: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  negative: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
  neutral: "bg-[#94A3B8]/15 text-[#94A3B8] border-[#94A3B8]/30",
  accent: "bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30",
};

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        variantClasses[variant]
      )}
    >
      {children}
    </span>
  );
}
