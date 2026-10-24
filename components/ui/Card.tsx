import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "completed" | "inset";
  padding?: "default" | "none" | "compact" | "hero";
}

const variantClasses = {
  default: "bg-bg-card border-border",
  completed: "bg-accent/15 border-accent/40",
  inset: "bg-bg-base border-border",
};

const paddingClasses = {
  default: "p-5 sm:p-6",
  none: "p-0",
  compact: "px-3 py-3 sm:px-3.5",
  hero: "px-5 py-6 sm:px-8 sm:py-8",
};

export function Card({
  children,
  className,
  variant = "default",
  padding = "default",
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        paddingClasses[padding],
        variantClasses[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
