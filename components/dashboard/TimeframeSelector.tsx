"use client";

export type Timeframe = "1M" | "3M" | "6M" | "1Y" | "ALL";

const OPTIONS: Timeframe[] = ["1M", "3M", "6M", "1Y", "ALL"];

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (t: Timeframe) => void;
}

export function TimeframeSelector({ value, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0a0a0a] border border-[#222222]">
      {OPTIONS.map((option) => {
        const isActive = value === option;
        return (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
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
