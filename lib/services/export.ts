import { db } from "@/db/client";
import {
  accounts,
  snapshots,
  accountValuations,
  fxRates,
  lifeMetricDefinitions,
  lifeMetricReadings,
  goals,
  subscriptions,
  careerPlans,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export const EXPORT_SCHEMA_VERSION = 1;

export type AccountRow = typeof accounts.$inferSelect;
export type SnapshotRow = typeof snapshots.$inferSelect;
export type ValuationRow = typeof accountValuations.$inferSelect;
export type FxRateRow = typeof fxRates.$inferSelect;
export type MetricDefRow = typeof lifeMetricDefinitions.$inferSelect;
export type MetricReadingRow = typeof lifeMetricReadings.$inferSelect;
export type GoalRow = typeof goals.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
export type CareerPlanRow = typeof careerPlans.$inferSelect;

export interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  accounts: AccountRow[];
  snapshots: SnapshotRow[];
  valuations: ValuationRow[];
  fxRates: FxRateRow[];
  lifeMetricDefinitions: MetricDefRow[];
  lifeMetricReadings: MetricReadingRow[];
  goals: GoalRow[];
  subscriptions: SubscriptionRow[];
  careerPlans: CareerPlanRow[];
}

export function exportToJson(): ExportPayload {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    accounts: db.select().from(accounts).all(),
    snapshots: db.select().from(snapshots).all(),
    valuations: db.select().from(accountValuations).all(),
    fxRates: db.select().from(fxRates).all(),
    lifeMetricDefinitions: db.select().from(lifeMetricDefinitions).all(),
    lifeMetricReadings: db.select().from(lifeMetricReadings).all(),
    goals: db.select().from(goals).all(),
    subscriptions: db.select().from(subscriptions).all(),
    careerPlans: db.select().from(careerPlans).all(),
  };
}

export function exportToCsv(): string {
  const allSnapshots = db.select().from(snapshots).all();
  const allAccounts = db.select().from(accounts).all();
  const allValuations = db.select().from(accountValuations).all();

  const accountMap = new Map(allAccounts.map((a) => [a.id, a]));
  const snapshotMap = new Map(allSnapshots.map((s) => [s.id, s]));

  const headers = [
    "snapshot_date",
    "account_name",
    "account_type",
    "account_category",
    "currency_code",
    "value_native",
    "value_gbp",
    "is_carried_forward",
    "snapshot_net_worth_gbp",
  ];

  const rows: string[] = [headers.join(",")];

  for (const valuation of allValuations) {
    const account = accountMap.get(valuation.accountId);
    const snapshot = snapshotMap.get(valuation.snapshotId);

    if (!account || !snapshot) continue;

    const row = [
      csvCell(snapshot.takenAt),
      csvCell(account.name),
      csvCell(account.type),
      csvCell(account.category),
      csvCell(account.currencyCode),
      String(valuation.valueNative),
      String(valuation.valueGbp),
      String(valuation.isCarriedForward ? 1 : 0),
      snapshot.netWorthGbp !== null ? String(snapshot.netWorthGbp) : "",
    ];

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
