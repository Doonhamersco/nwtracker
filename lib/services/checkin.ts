/**
 * Check-in service.
 *
 * Orchestrates the monthly check-in flow:
 *   1. buildDraft()  — pre-fill from last snapshot + fetch live rates
 *   2. commitSnapshot() — write immutable snapshot + valuations + FX + metrics
 *   3. savePartial()  — same as commit but marks snapshot as partial
 *
 * All write operations are wrapped in a single SQLite transaction.
 */

import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accounts,
  snapshots,
  accountValuations,
  fxRates,
  lifeMetricDefinitions,
  lifeMetricReadings,
  hevySyncLogs,
} from "@/db/schema";
import { fetchAllRatesForAccounts, type FxRateResult } from "./fx";
import { computeNetWorthFromInputs } from "@/lib/engine/net-worth";
import { hevyClient } from "@/lib/hevy/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DraftValuation {
  accountId: string;
  accountName: string;
  accountType: "ASSET" | "LIABILITY";
  category: string;
  currencyCode: string;
  coingeckoId: string | null;
  /** Value pre-filled from last snapshot (null = new account, no history) */
  lastValueNative: number | null;
  /** Live GBP rate for this currency at draft creation time */
  currentFxRateToGbp: number;
  /** Whether the rate was fetched live or is stale/manual */
  rateSource: "frankfurter" | "coingecko" | "manual";
  /** GBP value at the live rate — shown as a preview */
  previewValueGbp: number | null;
  /** True if pre-filled from last snapshot */
  isCarriedForward: boolean;
}

export interface DraftMetricReading {
  metricId: string;
  metricName: string;
  unit: string;
  displayColor: string;
  isHevyMetric: boolean;
  lastValue: number | null;
}

export interface CheckinDraft {
  accounts: DraftValuation[];
  metrics: DraftMetricReading[];
  lastSnapshotId: string | null;
  lastSnapshotDate: string | null;
  /** Live FX rates keyed by currency code */
  liveRates: Record<string, number>;
}

export interface SubmitValuation {
  accountId: string;
  valueNative: number;
  /** If true, user confirmed value unchanged from last snapshot */
  isCarriedForward: boolean;
}

export interface SubmitMetricReading {
  metricId: string;
  value: number;
  notes?: string;
}

export interface CommitCheckinInput {
  valuations: SubmitValuation[];
  metrics: SubmitMetricReading[];
  notes?: string;
  isPartial: boolean;
  /** Snapshot date — defaults to now */
  takenAt?: string;
}

export interface CommitCheckinResult {
  snapshotId: string;
  netWorthGbp: number;
  takenAt: string;
}

// ─── Build draft ─────────────────────────────────────────────────────────────

export async function buildCheckinDraft(): Promise<CheckinDraft> {
  // Fetch all active accounts
  const activeAccounts = db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.sortOrder)
    .all();

  // Find most recent committed snapshot
  const [lastSnapshot] = db
    .select({ id: snapshots.id, takenAt: snapshots.takenAt })
    .from(snapshots)
    .where(eq(snapshots.isPartial, false))
    .orderBy(desc(snapshots.takenAt))
    .limit(1)
    .all();

  // Get last known valuations for each account
  const lastValuationMap = new Map<string, number>();
  if (lastSnapshot) {
    const lastValuations = db
      .select({
        accountId: accountValuations.accountId,
        valueNative: accountValuations.valueNative,
      })
      .from(accountValuations)
      .where(eq(accountValuations.snapshotId, lastSnapshot.id))
      .all();
    for (const v of lastValuations) {
      lastValuationMap.set(v.accountId, v.valueNative);
    }
  }

  // Fetch live FX rates for all active account currencies
  let rateMap: Map<string, FxRateResult>;
  try {
    rateMap = await fetchAllRatesForAccounts(
      activeAccounts.map((a) => ({
        currencyCode: a.currencyCode,
        coingeckoId: a.coingeckoId,
      }))
    );
  } catch {
    // If live fetch fails, fall back to rate = 1 with manual source so check-in still loads
    rateMap = new Map();
    rateMap.set("GBP", { fromCurrency: "GBP", toCurrency: "GBP", rate: 1, source: "manual" });
  }

  const draftAccounts: DraftValuation[] = activeAccounts.map((acc) => {
    const rateResult = rateMap.get(acc.currencyCode.toUpperCase()) ?? {
      rate: 1,
      source: "manual" as const,
    };
    const lastValueNative = lastValuationMap.get(acc.id) ?? null;
    const previewValueGbp =
      lastValueNative !== null ? lastValueNative * rateResult.rate : null;

    return {
      accountId: acc.id,
      accountName: acc.name,
      accountType: acc.type as "ASSET" | "LIABILITY",
      category: acc.category,
      currencyCode: acc.currencyCode,
      coingeckoId: acc.coingeckoId,
      lastValueNative,
      currentFxRateToGbp: rateResult.rate,
      rateSource: rateResult.source,
      previewValueGbp,
      isCarriedForward: lastValueNative !== null,
    };
  });

  // Fetch all active life metric definitions
  const metricDefs = db
    .select()
    .from(lifeMetricDefinitions)
    .orderBy(lifeMetricDefinitions.sortOrder)
    .all();

  // Get last readings for each metric
  const lastReadingMap = new Map<string, number>();
  if (lastSnapshot) {
    const lastReadings = db
      .select({
        metricId: lifeMetricReadings.metricId,
        value: lifeMetricReadings.value,
      })
      .from(lifeMetricReadings)
      .where(eq(lifeMetricReadings.snapshotId, lastSnapshot.id))
      .all();
    for (const r of lastReadings) {
      lastReadingMap.set(r.metricId, r.value);
    }
  }

  const draftMetrics: DraftMetricReading[] = metricDefs.map((m) => ({
    metricId: m.id,
    metricName: m.name,
    unit: m.unit,
    displayColor: m.displayColor,
    isHevyMetric: m.isHevyMetric,
    lastValue: lastReadingMap.get(m.id) ?? null,
  }));

  // Fetch live Hevy values to pre-fill read-only Hevy metric rows
  const hasHevyMetrics = draftMetrics.some((m) => m.isHevyMetric);
  if (hasHevyMetrics) {
    try {
      const stats = await hevyClient.getStats();
      for (const dm of draftMetrics) {
        if (!dm.isHevyMetric) continue;
        if (dm.metricName.includes("Workout Sessions")) {
          dm.lastValue = stats.workouts_this_month;
        } else if (dm.metricName.includes("Training Volume")) {
          const total = stats.recent_volume.reduce((s, v) => s + v.total_volume_kg, 0);
          dm.lastValue = Math.round(total * 10) / 10;
        } else if (dm.metricName.includes("Personal Records")) {
          dm.lastValue = 0;
        }
      }
    } catch {
      // HEVY_API_KEY not set or API unreachable — keep last snapshot values silently
    }
  }

  const liveRates: Record<string, number> = {};
  for (const [currency, rate] of rateMap) {
    liveRates[currency] = rate.rate;
  }

  return {
    accounts: draftAccounts,
    metrics: draftMetrics,
    lastSnapshotId: lastSnapshot?.id ?? null,
    lastSnapshotDate: lastSnapshot?.takenAt ?? null,
    liveRates,
  };
}

// ─── Commit snapshot ─────────────────────────────────────────────────────────

export async function commitCheckin(
  input: CommitCheckinInput
): Promise<CommitCheckinResult> {
  // Resolve account details for FX rate lookup
  const accountRows = db
    .select({
      id: accounts.id,
      type: accounts.type,
      currencyCode: accounts.currencyCode,
      coingeckoId: accounts.coingeckoId,
    })
    .from(accounts)
    .all();
  const accountMap = new Map(accountRows.map((a) => [a.id, a]));

  // Fetch live rates for all submitted accounts
  const rateMap = await fetchAllRatesForAccounts(
    accountRows
      .filter((a) => input.valuations.some((v) => v.accountId === a.id))
      .map((a) => ({ currencyCode: a.currencyCode, coingeckoId: a.coingeckoId }))
  );

  // Compute GBP values
  const valuationInputs = input.valuations.map((v) => {
    const acc = accountMap.get(v.accountId);
    if (!acc) throw new Error(`Unknown account: ${v.accountId}`);
    const rate = rateMap.get(acc.currencyCode.toUpperCase())?.rate ?? 1;
    return {
      accountId: v.accountId,
      accountType: acc.type as "ASSET" | "LIABILITY",
      valueNative: v.valueNative,
      fxRateToGbp: rate,
      isCarriedForward: v.isCarriedForward,
      currencyCode: acc.currencyCode,
    };
  });

  const { netWorthGbp } = computeNetWorthFromInputs(
    valuationInputs.map((v) => ({
      accountType: v.accountType,
      valueNative: v.valueNative,
      fxRateToGbp: v.fxRateToGbp,
    }))
  );

  const snapshotId = randomUUID();
  const takenAt = input.takenAt ?? new Date().toISOString();

  // Everything in a single transaction — all or nothing
  db.transaction((tx) => {
    // 1. Create the snapshot
    tx.insert(snapshots)
      .values({
        id: snapshotId,
        takenAt,
        notes: input.notes ?? null,
        isPartial: input.isPartial,
        netWorthGbp,
      })
      .run();

    // 2. Insert all account valuations
    for (const v of valuationInputs) {
      tx.insert(accountValuations)
        .values({
          id: randomUUID(),
          snapshotId,
          accountId: v.accountId,
          valueNative: v.valueNative,
          valueGbp: v.valueNative * v.fxRateToGbp,
          isCarriedForward: v.isCarriedForward,
        })
        .run();
    }

    // 3. Store the FX rates used (deduplicated by currency)
    const seenCurrencies = new Set<string>();
    for (const v of valuationInputs) {
      const currency = v.currencyCode.toUpperCase();
      if (seenCurrencies.has(currency)) continue;
      seenCurrencies.add(currency);

      const rateResult = rateMap.get(currency);
      if (!rateResult) continue;

      tx.insert(fxRates)
        .values({
          id: randomUUID(),
          snapshotId,
          fromCurrency: currency,
          toCurrency: "GBP",
          rate: rateResult.rate,
          source: rateResult.source,
        })
        .run();
    }

    // 4. Insert life metric readings
    for (const m of input.metrics) {
      tx.insert(lifeMetricReadings)
        .values({
          id: randomUUID(),
          snapshotId,
          metricId: m.metricId,
          value: m.value,
          notes: m.notes ?? null,
        })
        .run();
    }
  });

  // 5. Record a Hevy sync log if any submitted metrics came from Hevy
  await insertHevySyncLogIfNeeded(snapshotId, input.metrics);

  return { snapshotId, netWorthGbp, takenAt };
}

// ─── Hevy sync log ────────────────────────────────────────────────────────────

async function insertHevySyncLogIfNeeded(
  snapshotId: string,
  submittedMetrics: SubmitMetricReading[]
): Promise<void> {
  if (submittedMetrics.length === 0) return;

  const submittedIds = submittedMetrics.map((m) => m.metricId);
  const hevyDefs = db
    .select({ id: lifeMetricDefinitions.id, name: lifeMetricDefinitions.name })
    .from(lifeMetricDefinitions)
    .where(eq(lifeMetricDefinitions.isHevyMetric, true))
    .all()
    .filter((d) => submittedIds.includes(d.id));

  if (hevyDefs.length === 0) return;

  const workoutsDef = hevyDefs.find((d) => d.name.includes("Workout Sessions"));
  const volumeDef = hevyDefs.find((d) => d.name.includes("Training Volume"));
  const prDef = hevyDefs.find((d) => d.name.includes("Personal Records"));

  const workoutsVal = workoutsDef
    ? (submittedMetrics.find((m) => m.metricId === workoutsDef.id)?.value ?? null)
    : null;
  const volumeVal = volumeDef
    ? (submittedMetrics.find((m) => m.metricId === volumeDef.id)?.value ?? null)
    : null;
  const prVal = prDef
    ? (submittedMetrics.find((m) => m.metricId === prDef.id)?.value ?? null)
    : null;

  // Try to capture raw Hevy JSON for auditability; skip if unavailable
  let rawJson: string | null = null;
  try {
    const stats = await hevyClient.getStats();
    rawJson = JSON.stringify(stats);
  } catch {
    // No API key or network issue — log without raw data
  }

  db.insert(hevySyncLogs)
    .values({
      id: randomUUID(),
      snapshotId,
      workoutsLast30d: workoutsVal !== null ? Math.round(workoutsVal) : null,
      totalVolumeKg: volumeVal,
      personalRecordsCount: prVal !== null ? Math.round(prVal) : null,
      rawJson,
    })
    .run();
}

// ─── Snapshot history helpers ─────────────────────────────────────────────────

export interface SnapshotSummary {
  id: string;
  takenAt: string;
  netWorthGbp: number | null;
  isPartial: boolean;
  notes: string | null;
}

export function getSnapshotHistory(limit = 120): SnapshotSummary[] {
  return db
    .select({
      id: snapshots.id,
      takenAt: snapshots.takenAt,
      netWorthGbp: snapshots.netWorthGbp,
      isPartial: snapshots.isPartial,
      notes: snapshots.notes,
    })
    .from(snapshots)
    .orderBy(desc(snapshots.takenAt))
    .limit(limit)
    .all();
}

export function getSnapshotById(id: string) {
  const [snapshot] = db
    .select()
    .from(snapshots)
    .where(eq(snapshots.id, id))
    .all();
  if (!snapshot) return null;

  const valuations = db
    .select()
    .from(accountValuations)
    .where(eq(accountValuations.snapshotId, id))
    .all();

  const rates = db
    .select()
    .from(fxRates)
    .where(eq(fxRates.snapshotId, id))
    .all();

  const metrics = db
    .select()
    .from(lifeMetricReadings)
    .where(eq(lifeMetricReadings.snapshotId, id))
    .all();

  return { snapshot, valuations, rates, metrics };
}
