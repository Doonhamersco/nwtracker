import { cn } from "@/lib/utils"

interface BrandMarkProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: { mark: "h-7 w-7 text-xs", word: "text-lg" },
  md: { mark: "h-8 w-8 text-sm", word: "text-xl" },
  lg: { mark: "h-14 w-14 text-2xl", word: "text-4xl" },
}

export function BrandMark({ size = "md", className }: BrandMarkProps) {
  const s = sizeClasses[size]
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full border border-accent font-display text-accent",
          s.mark
        )}
      >
        T
      </div>
      <span className={cn("font-display font-medium tracking-tight text-text", s.word)}>
        Tracker
      </span>
    </div>
  )
}
