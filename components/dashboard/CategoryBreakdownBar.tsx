"use client";

interface AccountSummary {
  category: string;
  valueGbp: number;
  accountType: "ASSET" | "LIABILITY";
}

interface CategoryBreakdownBarProps {
  accounts: AccountSummary[];
}

const CATEGORY_COLORS: Record<string, string> = {
  CASH: "#22C55E",
  ISA: "#06b6d4",
  CRYPTO: "#F59E0B",
  VEHICLE: "#0EA5E9",
  PENSION: "#8B5CF6",
  PROPERTY: "#EC4899",
  STOCKS: "#14B8A6",
  OTHER_ASSET: "#94A3B8",
};

export function CategoryBreakdownBar({ accounts }: CategoryBreakdownBarProps) {
  const assetAccounts = accounts.filter((a) => a.accountType === "ASSET" && a.valueGbp > 0);

  const categoryMap = new Map<string, number>();
  for (const acc of assetAccounts) {
    categoryMap.set(acc.category, (categoryMap.get(acc.category) ?? 0) + acc.valueGbp);
  }

  const total = Array.from(categoryMap.values()).reduce((sum, v) => sum + v, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-16 text-sm text-[#94A3B8]">
        No asset data
      </div>
    );
  }

  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => ({
      category,
      value,
      percent: (value / total) * 100,
      color: CATEGORY_COLORS[category] ?? "#94A3B8",
    }));

  return (
    <div className="flex flex-col gap-3">
      {/* Proportional bar */}
      <div className="flex rounded-full overflow-hidden h-3 gap-px">
        {categories.map(({ category, percent, color }) => (
          <div
            key={category}
            style={{ width: `${percent}%`, backgroundColor: color }}
            title={`${category}: ${percent.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {categories.map(({ category, value, percent, color }) => (
          <div
            key={category}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0a0a0a] border border-[#222222]"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-[#94A3B8]">{category}</span>
            <span className="text-xs font-mono font-medium text-[#F1F5F9]">
              £{value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-[#94A3B8]">{percent.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
