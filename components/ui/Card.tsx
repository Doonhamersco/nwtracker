import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "completed";
}

const variantClasses = {
  default: "bg-bg-card border-border",
  completed: "bg-accent/15 border-accent/40",
};

export function Card({ children, className, variant = "default" }: CardProps) {
  return (
    <div
      className={cn(
        "border rounded-2xl p-5 sm:p-6",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
