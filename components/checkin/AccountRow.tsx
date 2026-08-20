"use client";

import { Badge } from "@/components/ui/Badge";

interface DraftValuation {
  accountId: string;
  accountName: string;
  accountType: "ASSET" | "LIABILITY";
  category: string;
  currencyCode: string;
  coingeckoId: string | null;
  lastValueNative: number | null;
  currentFxRateToGbp: number;
  rateSource: "frankfurter" | "coingecko" | "manual";
  previewValueGbp: number | null;
  isCarriedForward: boolean;
}

interface AccountRowProps {
  account: DraftValuation;
  value: number;
  onChange: (value: number, isCarriedForward: boolean) => void;
}

function getInputStep(currencyCode: string, coingeckoId: string | null): string {
  const code = currencyCode.toUpperCase();
  if (coingeckoId || code === "BTC" || code === "ETH") return "0.00001";
  if (code === "GBP" || code === "USD" || code === "EUR") return "0.01";
  return "0.01";
}

export function AccountRow({ account, value, onChange }: AccountRowProps) {
  const step = getInputStep(account.currencyCode, account.coingeckoId);
  const previewGbp = value * account.currentFxRateToGbp;
  const isCarriedForward = account.isCarriedForward;
  const isLiveRate =
    account.rateSource === "coingecko" || account.rateSource === "frankfurter";
  const isGbp = account.currencyCode.toUpperCase() === "GBP";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-bg-base border border-border hover:border-accent/40 transition-colors">
      {/* Left: account info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text truncate">
            {account.accountName}
          </span>
          <Badge variant={account.accountType === "LIABILITY" ? "negative" : "accent"}>
            {account.category}
          </Badge>
          {!isGbp && (
            <Badge variant="neutral">{account.currencyCode.toUpperCase()}</Badge>
          )}
          {isCarriedForward && (
            <Badge variant="neutral">unchanged</Badge>
          )}
        </div>

        {/* Live rate info */}
        {isLiveRate && !isGbp && (
          <p className="text-xs text-muted mt-1">
            Live: 1 {account.currencyCode.toUpperCase()} ={" "}
            £{account.currentFxRateToGbp.toLocaleString("en-GB", {
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}
            <span className="ml-1 text-accent">({account.rateSource})</span>
          </p>
        )}
      </div>

      {/* Right: input + preview + actions */}
      <div className="flex w-full items-center gap-3 sm:w-auto sm:flex-shrink-0">
        {/* Preview GBP */}
        {!isGbp && (
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted">≈</p>
            <p className="text-sm font-mono font-medium text-text">
              £{previewGbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </p>
          </div>
        )}

        {/* Number input */}
        <div className="flex min-w-0 flex-1 flex-col items-stretch sm:flex-none sm:items-end">
          <div className="relative">
            {isGbp && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">£</span>
            )}
            <input
              type="number"
              value={value}
              step={step}
              min="0"
              onChange={(e) => {
                const num = parseFloat(e.target.value);
                if (!isNaN(num)) {
                  onChange(num, false);
                }
              }}
              className={`w-full min-h-11 rounded-lg border border-border bg-bg-card text-text text-sm font-mono py-2 pr-3 focus:outline-none focus:border-accent transition-colors sm:w-36 ${isGbp ? "pl-7" : "pl-3"}`}
            />
          </div>
          {/* Mobile GBP preview */}
          {!isGbp && (
            <p className="text-xs text-muted mt-1 sm:hidden">
              ≈ £{previewGbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </p>
          )}
        </div>

        {/* Unchanged button */}
        <button
          onClick={() => onChange(value, true)}
          title="Mark as unchanged"
          className={`min-h-11 shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            isCarriedForward
              ? "bg-accent/20 border-accent text-accent"
              : "border-border text-muted hover:border-accent/50 hover:text-text"
          }`}
        >
          ✓
        </button>
      </div>
    </div>
  );
}
