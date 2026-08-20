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
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-[#0a0a0a] border border-[#222222] hover:border-[#22c55e]/40 transition-colors">
      {/* Left: account info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[#F1F5F9] truncate">
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
          <p className="text-xs text-[#94A3B8] mt-1">
            Live: 1 {account.currencyCode.toUpperCase()} ={" "}
            £{account.currentFxRateToGbp.toLocaleString("en-GB", {
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
            })}
            <span className="ml-1 text-[#22c55e]">({account.rateSource})</span>
          </p>
        )}
      </div>

      {/* Right: input + preview + actions */}
      <div className="flex w-full items-center gap-3 sm:w-auto sm:flex-shrink-0">
        {/* Preview GBP */}
        {!isGbp && (
          <div className="text-right hidden sm:block">
            <p className="text-xs text-[#94A3B8]">≈</p>
            <p className="text-sm font-mono font-medium text-[#F1F5F9]">
              £{previewGbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </p>
          </div>
        )}

        {/* Number input */}
        <div className="flex min-w-0 flex-1 flex-col items-stretch sm:flex-none sm:items-end">
          <div className="relative">
            {isGbp && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">£</span>
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
              className={`w-full min-h-11 rounded-lg border border-[#222222] bg-[#111111] text-[#F1F5F9] text-sm font-mono py-2 pr-3 focus:outline-none focus:border-[#22c55e] transition-colors sm:w-36 ${isGbp ? "pl-7" : "pl-3"}`}
            />
          </div>
          {/* Mobile GBP preview */}
          {!isGbp && (
            <p className="text-xs text-[#94A3B8] mt-1 sm:hidden">
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
              ? "bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e]"
              : "border-[#222222] text-[#94A3B8] hover:border-[#22c55e]/50 hover:text-[#F1F5F9]"
          }`}
        >
          ✓
        </button>
      </div>
    </div>
  );
}
