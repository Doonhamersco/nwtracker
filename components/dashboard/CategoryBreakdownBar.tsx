"use client";

import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface AccountSummary {
  category: string;
  valueGbp: number;
  accountType: "ASSET" | "LIABILITY";
}

interface CategoryBreakdownBarProps {
  accounts: AccountSummary[];
}

const CATEGORY_COLORS: Record<string, string> = {
  CASH: "#c5a059",
  ISA: "#d4b978",
  CRYPTO: "#a8843e",
  VEHICLE: "#8a7a5c",
  PENSION: "#e0c992",
  PROPERTY: "#9c8a62",
  STOCKS: "#b8954a",
  OTHER_ASSET: "#7a6c50",
};

const CATEGORY_LABELS: Record<string, string> = {
  CASH: "Cash",
  ISA: "ISA",
  CRYPTO: "Crypto",
  VEHICLE: "Vehicle",
  PENSION: "Pension",
  PROPERTY: "Property",
  STOCKS: "Investments",
  OTHER_ASSET: "Other",
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
      <div className="flex items-center justify-center h-36 text-sm text-muted">
        No asset data
      </div>
    );
  }

  const categories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => ({
      category,
      name: CATEGORY_LABELS[category] ?? category,
      value,
      percent: (value / total) * 100,
      color: CATEGORY_COLORS[category] ?? "#9c8a62",
    }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-5">
        <div className="h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                dataKey="value"
                nameKey="name"
                innerRadius={38}
                outerRadius={58}
                stroke="none"
                paddingAngle={1.5}
              >
                {categories.map((c) => (
                  <Cell key={c.category} fill={c.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {categories.slice(0, 5).map((c) => (
            <li key={c.category} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-muted">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span className="truncate">{c.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-text">{c.percent.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <Link
        href="/assets"
        className="text-sm text-accent hover:text-accent-hover transition-colors"
      >
        View full breakdown →
      </Link>
    </div>
  );
}
