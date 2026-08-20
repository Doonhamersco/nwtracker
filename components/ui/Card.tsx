import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "completed";
}

const variantClasses = {
  default: "bg-[#111111] border-[#222222]",
  completed: "bg-[#166534] border-[#22c55e]",
};

export function Card({ children, className, variant = "default" }: CardProps) {
  return (
    <div
      className={cn(
        "border rounded-2xl p-4 sm:p-5",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
