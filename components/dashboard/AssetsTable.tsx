"use client";

import { Badge } from "@/components/ui/Badge";

interface ValuationRow {
  id: string;
  accountId: string;
  valueNative: number;
  valueGbp: number;
  isCarriedForward: boolean;
  createdAt: string;
}

interface AccountRow {
  id: string;
  name: string;
  type: "ASSET" | "LIABILITY";
  category: string;
  currencyCode: string;
}

interface AssetsTableProps {
  valuations: ValuationRow[];
  accounts: AccountRow[];
  previousValuations: ValuationRow[];
}

function formatGbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNative(value: number, currency: string): string {
  if (currency === "GBP") return "";
  const decimals = ["BTC", "ETH"].includes(currency.toUpperCase()) ? 6 : 2;
  return `${value.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency.toUpperCase()}`;
}

interface TableRowData {
  account: AccountRow;
  valuation: ValuationRow;
  momChange: number | null;
  momPercent: number | null;
}

function AccountTableRow({ row }: { row: TableRowData }) {
  const { account, valuation, momChange, momPercent } = row;
  const isLiability = account.type === "LIABILITY";

  return (
    <tr className="border-b border-border hover:bg-bg-hover transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">{account.name}</span>
          {valuation.isCarriedForward && (
            <Badge variant="neutral">carried forward</Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={isLiability ? "negative" : "accent"}>{account.category}</Badge>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-mono text-sm font-medium ${isLiability ? "text-negative" : "text-text"}`}>
          {isLiability ? "-" : ""}{formatGbp(valuation.valueGbp)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-mono text-xs text-muted">
          {formatNative(valuation.valueNative, account.currencyCode)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {momChange !== null ? (
          <span className={`font-mono text-sm ${momChange >= 0 ? "text-positive" : "text-negative"}`}>
            {momChange >= 0 ? "▲" : "▼"} £
            {Math.abs(momChange).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            {momPercent !== null && (
              <span className="text-xs ml-1 opacity-75">
                ({momPercent >= 0 ? "+" : ""}
                {momPercent.toFixed(1)}%)
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-xs text-muted">
          {new Date(valuation.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </td>
    </tr>
  );
}

function buildRows(
  valuations: ValuationRow[],
  accounts: AccountRow[],
  previousValuations: ValuationRow[],
  type: "ASSET" | "LIABILITY"
): TableRowData[] {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const prevMap = new Map(previousValuations.map((v) => [v.accountId, v]));

  return valuations
    .filter((v) => {
      const acc = accountMap.get(v.accountId);
      return acc?.type === type;
    })
    .map((v) => {
      const account = accountMap.get(v.accountId)!;
      const prev = prevMap.get(v.accountId);
      const momChange = prev !== undefined ? v.valueGbp - prev.valueGbp : null;
      const momPercent =
        momChange !== null && prev && prev.valueGbp !== 0
          ? (momChange / prev.valueGbp) * 100
          : null;
      return { account, valuation: v, momChange, momPercent };
    })
    .sort((a, b) => b.valuation.valueGbp - a.valuation.valueGbp);
}

const TABLE_HEADER = (
  <thead>
    <tr className="border-b border-border">
      {["Account", "Type", "Value (GBP)", "Native", "MoM Change", "Last Updated"].map(
        (col) => (
          <th
            key={col}
            className="px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-left last:text-right [&:nth-child(3)]:text-right [&:nth-child(4)]:text-right [&:nth-child(5)]:text-right"
          >
            {col}
          </th>
        )
      )}
    </tr>
  </thead>
);

export function AssetsTable({ valuations, accounts, previousValuations }: AssetsTableProps) {
  const assetRows = buildRows(valuations, accounts, previousValuations, "ASSET");
  const liabilityRows = buildRows(valuations, accounts, previousValuations, "LIABILITY");

  if (assetRows.length === 0 && liabilityRows.length === 0) {
    return (
      <div className="text-center py-8 text-muted text-sm">
        No account data in this snapshot
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        {TABLE_HEADER}
        <tbody>
          {assetRows.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-2 text-xs font-semibold text-accent uppercase tracking-wider bg-accent/5"
                >
                  Assets
                </td>
              </tr>
              {assetRows.map((row) => (
                <AccountTableRow key={row.valuation.id} row={row} />
              ))}
            </>
          )}
          {liabilityRows.length > 0 && (
            <>
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-2 text-xs font-semibold text-negative uppercase tracking-wider bg-negative/5"
                >
                  Liabilities
                </td>
              </tr>
              {liabilityRows.map((row) => (
                <AccountTableRow key={row.valuation.id} row={row} />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
