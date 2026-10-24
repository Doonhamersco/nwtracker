export type Timeframe = "1M" | "3M" | "6M" | "1Y" | "ALL";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SeriesPoint {
  snapshotId: string;
  takenAt: string;
  isoDate: string;
  netWorthGbp: number | null;
  assetsGbp: number | null;
  debtGbp: number | null;
}

export interface AccountMove {
  name: string;
  deltaGbp: number;
  type: "ASSET" | "LIABILITY";
}

export interface DashboardSeriesInput {
  snapshots: Array<{
    id: string;
    takenAt: string;
    netWorthGbp: number | null;
    isPartial: boolean;
  }>;
  valuations: Array<{
    snapshotId: string;
    accountId: string;
    valueGbp: number;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    type: "ASSET" | "LIABILITY";
  }>;
}

export interface DashboardSeries {
  points: SeriesPoint[];
  movesByDate: Record<string, AccountMove[]>;
}

export interface ChangeStat {
  delta: number | null;
  percent: number | null;
  spark: number[];
}

export interface LevelStat {
  latest: number | null;
  delta: number | null;
  percent: number | null;
  spark: number[];
}

const MAX_MOVES = 12;

export function parseTakenAt(value: string): number {
  const trimmed = value.trim();
  const normalised = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const parsed = Date.parse(normalised);
  if (!Number.isNaN(parsed)) return parsed;
  return Date.parse(`${trimmed.slice(0, 10)}T12:00:00`);
}

export function isoDateFrom(value: string): string {
  return value.slice(0, 10);
}

export function timeframeCutoff(timeframe: Timeframe, now = new Date()): Date | null {
  const days: Record<Timeframe, number | null> = {
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
    ALL: null,
  };
  const span = days[timeframe];
  if (span === null) return null;
  return new Date(now.getTime() - span * DAY_MS);
}

export function worthOf(point: SeriesPoint, hideDebt: boolean): number | null {
  if (point.netWorthGbp === null && point.assetsGbp === null) return null;
  const net = point.netWorthGbp ?? (point.assetsGbp ?? 0) - (point.debtGbp ?? 0);
  return hideDebt ? net + (point.debtGbp ?? 0) : net;
}

export function buildDashboardSeries(input: DashboardSeriesInput): DashboardSeries {
  const accountById = new Map(input.accounts.map((account) => [account.id, account]));
  const valuationsBySnapshot = new Map<string, Map<string, number>>();

  for (const valuation of input.valuations) {
    let bucket = valuationsBySnapshot.get(valuation.snapshotId);
    if (!bucket) {
      bucket = new Map();
      valuationsBySnapshot.set(valuation.snapshotId, bucket);
    }
    bucket.set(valuation.accountId, valuation.valueGbp);
  }

  const committed = input.snapshots
    .filter((snapshot) => !snapshot.isPartial)
    .slice()
    .sort((a, b) => parseTakenAt(a.takenAt) - parseTakenAt(b.takenAt));

  const points: SeriesPoint[] = [];
  const movesByDate: Record<string, AccountMove[]> = {};
  let previousVals: Map<string, number> | null = null;

  for (const snapshot of committed) {
    const vals = valuationsBySnapshot.get(snapshot.id);
    let assetsGbp: number | null = null;
    let debtGbp: number | null = null;
    if (vals && vals.size > 0) {
      assetsGbp = 0;
      debtGbp = 0;
      for (const [accountId, value] of vals) {
        const account = accountById.get(accountId);
        if (!account) continue;
        if (account.type === "LIABILITY") debtGbp += value;
        else assetsGbp += value;
      }
    }

    const isoDate = isoDateFrom(snapshot.takenAt);
    points.push({
      snapshotId: snapshot.id,
      takenAt: snapshot.takenAt,
      isoDate,
      netWorthGbp: snapshot.netWorthGbp,
      assetsGbp,
      debtGbp,
    });

    if (vals && previousVals) {
      const moves: AccountMove[] = [];
      const ids = new Set([...vals.keys(), ...previousVals.keys()]);
      for (const id of ids) {
        const account = accountById.get(id);
        if (!account) continue;
        const current = vals.get(id) ?? 0;
        const previous = previousVals.get(id) ?? 0;
        const raw = current - previous;
        const deltaGbp = account.type === "LIABILITY" ? -raw : raw;
        if (Math.abs(deltaGbp) < 0.5) continue;
        moves.push({ name: account.name, deltaGbp, type: account.type });
      }
      moves.sort(
        (a, b) => Math.abs(b.deltaGbp) - Math.abs(a.deltaGbp) || a.name.localeCompare(b.name)
      );
      movesByDate[isoDate] = moves.slice(0, MAX_MOVES);
    }

    if (vals) previousVals = vals;
  }

  return { points, movesByDate };
}

interface DatedWorth {
  point: SeriesPoint;
  worth: number;
  t: number;
}

function datedWorth(points: SeriesPoint[], hideDebt: boolean): DatedWorth[] {
  return points
    .map((point) => {
      const worth = worthOf(point, hideDebt);
      if (worth === null) return null;
      return { point, worth, t: parseTakenAt(point.takenAt) };
    })
    .filter((row): row is DatedWorth => row !== null)
    .sort((a, b) => a.t - b.t);
}

function findBaseline(
  rows: DatedWorth[],
  latest: DatedWorth,
  lookbackDays: number,
  toleranceDays: number
): DatedWorth | null {
  const target = latest.t - lookbackDays * DAY_MS;
  let best: DatedWorth | null = null;
  let bestDistance = Infinity;
  for (const row of rows) {
    if (row.point.snapshotId === latest.point.snapshotId) continue;
    if (row.t > latest.t) continue;
    const distance = Math.abs(row.t - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = row;
    }
  }
  if (!best || bestDistance > toleranceDays * DAY_MS) return null;
  return best;
}

export function rollingChange(
  points: SeriesPoint[],
  hideDebt: boolean,
  lookbackDays: number,
  toleranceDays: number
): ChangeStat {
  const rows = datedWorth(points, hideDebt);
  if (rows.length === 0) return { delta: null, percent: null, spark: [] };

  const spark: number[] = [];
  for (const row of rows) {
    const base = findBaseline(rows, row, lookbackDays, toleranceDays);
    if (base) spark.push(row.worth - base.worth);
  }

  const latest = rows[rows.length - 1];
  const base = findBaseline(rows, latest, lookbackDays, toleranceDays);
  if (!base) return { delta: null, percent: null, spark };
  const delta = latest.worth - base.worth;
  const percent = base.worth !== 0 ? (delta / Math.abs(base.worth)) * 100 : null;
  return { delta, percent, spark };
}

export function sliceByTimeframe(
  points: SeriesPoint[],
  timeframe: Timeframe,
  now = new Date()
): SeriesPoint[] {
  const cutoff = timeframeCutoff(timeframe, now);
  if (!cutoff) return points;
  const cutoffMs = cutoff.getTime();
  return points.filter((point) => parseTakenAt(point.takenAt) >= cutoffMs);
}

export function levelStat(values: Array<number | null>): LevelStat {
  const spark = values.filter((value): value is number => value !== null);
  if (spark.length === 0) return { latest: null, delta: null, percent: null, spark: [] };
  const latest = spark[spark.length - 1];
  if (spark.length < 2) return { latest, delta: null, percent: null, spark };
  const previous = spark[spark.length - 2];
  const delta = latest - previous;
  const percent = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  return { latest, delta, percent, spark };
}

export function formatSignedPercent(percent: number): string {
  const sign = percent > 0 ? "+" : percent < 0 ? "−" : "";
  return `${sign}${Math.abs(percent).toFixed(1)}%`;
}

export function checkinDueLabel(lastTakenAt: string | null, now = new Date()): string | null {
  if (!lastTakenAt) return "due now";
  const last = parseTakenAt(lastTakenAt);
  if (Number.isNaN(last)) return null;
  const due = new Date(last);
  due.setMonth(due.getMonth() + 1);
  const ms = due.getTime() - now.getTime();
  const days = ms >= 0 ? Math.ceil(ms / DAY_MS) : Math.floor(ms / DAY_MS);
  if (days > 1) return `due in ${days} days`;
  if (days === 1) return "due in 1 day";
  if (days === 0) return "due today";
  const overdue = Math.abs(days);
  return overdue === 1 ? "1 day overdue" : `${overdue} days overdue`;
}
