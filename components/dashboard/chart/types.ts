import type { AccountMove } from "@/lib/dashboard-kpis";

export type SeriesKey = "netWorth" | "weight";

export interface NotableEvent {
  id: string;
  date: string;
  emoji: string;
  label: string;
}

export interface WeightReading {
  id: string;
  date: string;
  weightKg: number;
  snapshotId: string;
}

export interface ChartDataPoint {
  ts: number;
  date: string;
  isoDate: string;
  value: number | null;
  prev?: number;
  prevTs?: number;
  weight: number | null;
  moves: AccountMove[];
}

export type { AccountMove };
