"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { AccountRow } from "@/components/checkin/AccountRow";
import { MetricRow } from "@/components/checkin/MetricRow";

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

interface DraftMetricReading {
  metricId: string;
  metricName: string;
  unit: string;
  displayColor: string;
  isHevyMetric: boolean;
  lastValue: number | null;
}

interface CheckinDraft {
  accounts: DraftValuation[];
  metrics: DraftMetricReading[];
  lastSnapshotId: string | null;
  lastSnapshotDate: string | null;
  liveRates: Record<string, number>;
}

interface ValuationState {
  valueNative: number;
  isCarriedForward: boolean;
}

interface CheckinFormClientProps {
  draft: CheckinDraft;
}

export function CheckinFormClient({ draft }: CheckinFormClientProps) {
  const router = useRouter();

  const [valuations, setValuations] = useState<Record<string, ValuationState>>(
    () => {
      const init: Record<string, ValuationState> = {};
      for (const acc of draft.accounts) {
        init[acc.accountId] = {
          valueNative: acc.lastValueNative ?? 0,
          isCarriedForward: acc.isCarriedForward,
        };
      }
      return init;
    }
  );

  const [metrics, setMetrics] = useState<Record<string, number | null>>(
    () => {
      const init: Record<string, number | null> = {};
      for (const m of draft.metrics) {
        init[m.metricId] = m.lastValue;
      }
      return init;
    }
  );

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    netWorthGbp: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assetAccounts = draft.accounts.filter((a) => a.accountType === "ASSET");
  const liabilityAccounts = draft.accounts.filter((a) => a.accountType === "LIABILITY");

  async function handleSubmit(isPartial: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/checkin/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valuations: Object.entries(valuations).map(([accountId, v]) => ({
            accountId,
            valueNative: v.valueNative,
            isCarriedForward: v.isCarriedForward,
          })),
          metrics: Object.entries(metrics)
            .filter(([, v]) => v !== null)
            .map(([metricId, value]) => ({ metricId, value: value! })),
          notes: notes || undefined,
          isPartial,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json() as { netWorthGbp: number };
      setSubmitResult(result);
      setSubmitted(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted && submitResult) {
    return (
      <Card className="max-w-lg mx-auto mt-12 text-center">
        <div className="flex flex-col items-center gap-4 py-4">
          <CheckCircle className="text-[#22C55E]" size={48} />
          <h2 className="text-xl font-bold text-[#F1F5F9]">Snapshot saved!</h2>
          <p className="text-[#94A3B8]">
            Net worth:{" "}
            <span className="text-[#22C55E] font-bold font-mono">
              £{submitResult.netWorthGbp.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            </span>
          </p>
          <p className="text-xs text-[#94A3B8]">Redirecting to dashboard…</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Assets section */}
      {assetAccounts.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-[#F1F5F9] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            Assets
            <span className="text-xs text-[#94A3B8] font-normal">
              ({assetAccounts.length})
            </span>
          </h2>
          <div className="space-y-2">
            {assetAccounts.map((acc) => (
              <AccountRow
                key={acc.accountId}
                account={acc}
                value={valuations[acc.accountId]?.valueNative ?? 0}
                onChange={(val, cf) =>
                  setValuations((prev) => ({
                    ...prev,
                    [acc.accountId]: { valueNative: val, isCarriedForward: cf },
                  }))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Liabilities section */}
      {liabilityAccounts.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-[#F1F5F9] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            Liabilities
            <span className="text-xs text-[#94A3B8] font-normal">
              ({liabilityAccounts.length})
            </span>
          </h2>
          <div className="space-y-2">
            {liabilityAccounts.map((acc) => (
              <AccountRow
                key={acc.accountId}
                account={acc}
                value={valuations[acc.accountId]?.valueNative ?? 0}
                onChange={(val, cf) =>
                  setValuations((prev) => ({
                    ...prev,
                    [acc.accountId]: { valueNative: val, isCarriedForward: cf },
                  }))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Life metrics section */}
      {draft.metrics.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-[#F1F5F9] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
            Life Metrics
            <span className="text-xs text-[#94A3B8] font-normal">
              ({draft.metrics.length})
            </span>
          </h2>
          <div className="space-y-2">
            {draft.metrics.map((m) => (
              <MetricRow
                key={m.metricId}
                metric={m}
                value={metrics[m.metricId] ?? null}
                onChange={(val) =>
                  setMetrics((prev) => ({ ...prev, [m.metricId]: val }))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      <section>
        <h2 className="text-base font-semibold text-[#F1F5F9] mb-3">
          Notes{" "}
          <span className="text-xs text-[#94A3B8] font-normal">(optional)</span>
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any notes about this snapshot…"
          className="w-full rounded-xl border border-[#222222] bg-[#111111] text-[#F1F5F9] text-sm px-4 py-3 placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#22c55e] transition-colors resize-none"
        />
      </section>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 px-4 py-3 text-sm text-[#EF4444]">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Footer buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => handleSubmit(true)}
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#222222] text-sm text-[#94A3B8] hover:text-[#F1F5F9] hover:border-[#22c55e]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Save as Partial
        </button>
        <button
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#22c55e] text-white text-sm font-medium hover:bg-[#16a34a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Commit Snapshot
        </button>
      </div>
    </div>
  );
}
