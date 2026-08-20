"use client";

export type Timeframe = "1M" | "3M" | "6M" | "1Y" | "ALL";

const OPTIONS: Timeframe[] = ["1M", "3M", "6M", "1Y", "ALL"];

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (t: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto p-1 rounded-lg bg-[#0a0a0a] border border-[#222222]">
      {OPTIONS.map((option) => {
        const isActive = value === option;
        return (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-1 rounded-md text-xs font-medium transition-colors ${
              isActive
                ? "bg-[#111111] border border-[#22c55e] text-[#F1F5F9]"
                : "text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1a1a1a]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
