import { cn } from "@/lib/utils";

type Variant = "positive" | "negative" | "neutral" | "accent";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  positive: "bg-positive/15 text-positive border-positive/30",
  negative: "bg-negative/15 text-negative border-negative/30",
  neutral: "bg-muted/15 text-muted border-muted/30",
  accent: "bg-accent/15 text-accent border-accent/30",
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
