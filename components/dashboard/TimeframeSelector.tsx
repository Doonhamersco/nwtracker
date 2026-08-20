"use client";

export type Timeframe = "1M" | "3M" | "6M" | "1Y" | "ALL";

const OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1Y", label: "1Y" },
  { value: "ALL", label: "All" },
];

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (t: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto">
      {OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-text hover:bg-bg-hover"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
