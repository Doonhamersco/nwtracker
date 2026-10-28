import { and, eq } from "drizzle-orm";
import { db, type DB } from "@/db/client";
import { accountValuations, accounts, goals, snapshots, transactions } from "@/db/schema";
import { transactionFingerprint } from "@/lib/spending/hash";
import { roundPence } from "@/lib/spending/money";

type Writer = Pick<DB, "select" | "insert" | "update" | "delete">;

export interface MergeOptions {
  sourceId?: string;
  targetId?: string;
  sourceName?: string;
  targetName?: string;
  dryRun?: boolean;
}

export interface MergeReport {
  dryRun: boolean;
  status: "merged" | "nothing-to-merge" | "refused";
  reason?: string;
  source?: { id: string; name: string };
  target?: { id: string; name: string };
  valuationsMoved: number;
  valuationsDeduped: number;
  carriedForwardReplaced: number;
  transactionsMoved: number;
  transactionsDeduped: number;
  goalsRelinked: number;
  snapshotsRecomputed: number;
  sourceDeleted: boolean;
  lines: string[];
}

type AccountRow = typeof accounts.$inferSelect;
type ValuationRow = typeof accountValuations.$inferSelect;
type TransactionRow = typeof transactions.$inferSelect;

interface ValuationView {
  valuation: ValuationRow;
  takenAt: string;
  day: string;
  fromSource: boolean;
}

const EMPTY: Omit<MergeReport, "dryRun" | "status"> = {
  valuationsMoved: 0,
  valuationsDeduped: 0,
  carriedForwardReplaced: 0,
  transactionsMoved: 0,
  transactionsDeduped: 0,
  goalsRelinked: 0,
  snapshotsRecomputed: 0,
  sourceDeleted: false,
  lines: [],
};

export function mergeAccounts(options: MergeOptions, database: DB = db): MergeReport {
  const dryRun = options.dryRun === true;
  const loaded = loadPair(database, options);
  if (loaded.status !== "ready") {
    return { dryRun, ...EMPTY, status: loaded.status, reason: loaded.reason, source: loaded.source, target: loaded.target };
  }

  const { source, target } = loaded;
  const plan = buildPlan(database, source, target);
  const report: MergeReport = {
    dryRun,
    status: "merged",
    source: { id: source.id, name: source.name },
    target: { id: target.id, name: target.name },
    ...plan.counts,
    sourceDeleted: !dryRun,
    lines: plan.lines,
  };

  if (dryRun) {
    report.sourceDeleted = false;
    report.lines.unshift(`Would delete “${source.name}” after the move.`);
    return report;
  }

  database.transaction((tx) => {
    applyPlan(tx as Writer, source.id, target.id, plan);
  });
  report.lines.push(`Deleted “${source.name}”.`);
  return report;
}

function loadPair(
  database: Writer,
  options: MergeOptions
):
  | { status: "ready"; source: AccountRow; target: AccountRow }
  | { status: "nothing-to-merge" | "refused"; reason: string; source?: { id: string; name: string }; target?: { id: string; name: string } } {
  const all = database.select().from(accounts).all();
  const source = findAccount(all, options.sourceId, options.sourceName);
  const target = findAccount(all, options.targetId, options.targetName);

  if (source.matches.length > 1) {
    return { status: "refused", reason: `More than one account matches “${options.sourceName ?? options.sourceId}”.` };
  }
  if (target.matches.length > 1) {
    return { status: "refused", reason: `More than one account matches “${options.targetName ?? options.targetId}”.` };
  }
  if (!target.account) {
    return { status: "refused", reason: "Target account was not found." };
  }
  if (!source.account) {
    return {
      status: "nothing-to-merge",
      reason: "Source account was not found.",
      target: { id: target.account.id, name: target.account.name },
    };
  }
  if (source.account.id === target.account.id) {
    return { status: "refused", reason: "Source and target are the same account." };
  }
  if (source.account.type !== target.account.type || source.account.currencyCode !== target.account.currencyCode) {
    return {
      status: "refused",
      reason: `${source.account.name} is ${source.account.type} ${source.account.currencyCode} and ${target.account.name} is ${target.account.type} ${target.account.currencyCode}. Refusing to merge different kinds of account.`,
      source: { id: source.account.id, name: source.account.name },
      target: { id: target.account.id, name: target.account.name },
    };
  }
  return { status: "ready", source: source.account, target: target.account };
}

function findAccount(all: AccountRow[], id?: string, name?: string): { account: AccountRow | null; matches: AccountRow[] } {
  if (id) {
    const account = all.find((row) => row.id === id) ?? null;
    return { account, matches: account ? [account] : [] };
  }
  const wanted = name?.trim().toLowerCase();
  if (!wanted) return { account: null, matches: [] };
  const matches = all.filter((row) => row.name.trim().toLowerCase() === wanted);
  return { account: matches.length === 1 ? matches[0] : null, matches };
}

interface Plan {
  counts: Omit<MergeReport, "dryRun" | "status" | "source" | "target" | "reason" | "sourceDeleted" | "lines">;
  lines: string[];
  moveValuationIds: string[];
  deleteValuationIds: string[];
  keeperUpdates: Array<{ id: string; valueNative: number; valueGbp: number; isCarriedForward: boolean }>;
  moveTransactions: Array<{ id: string; nextId: string }>;
  deleteTransactionIds: string[];
  touchedSnapshots: string[];
  goalIds: string[];
}

function buildPlan(database: Writer, source: AccountRow, target: AccountRow): Plan {
  const snapshotRows = database.select().from(snapshots).all();
  const takenAt = new Map(snapshotRows.map((row) => [row.id, row.takenAt]));
  const valuationRows = database
    .select()
    .from(accountValuations)
    .all()
    .filter((row) => row.accountId === source.id || row.accountId === target.id);

  const views: ValuationView[] = valuationRows.map((valuation) => {
    const at = takenAt.get(valuation.snapshotId) ?? "";
    return {
      valuation,
      takenAt: at,
      day: at.trim().slice(0, 10),
      fromSource: valuation.accountId === source.id,
    };
  });

  const byDay = new Map<string, ValuationView[]>();
  for (const view of views) {
    const bucket = byDay.get(view.day) ?? [];
    bucket.push(view);
    byDay.set(view.day, bucket);
  }

  const moveValuationIds: string[] = [];
  const deleteValuationIds: string[] = [];
  const keeperUpdates: Plan["keeperUpdates"] = [];
  const touched = new Set<string>();
  const lines: string[] = [];
  let valuationsMoved = 0;
  let valuationsDeduped = 0;
  let carriedForwardReplaced = 0;

  for (const [day, bucket] of byDay) {
    const sources = bucket.filter((view) => view.fromSource);
    const targets = bucket.filter((view) => !view.fromSource);
    if (sources.length === 0) continue;

    if (targets.length === 0) {
      for (const view of sources) {
        moveValuationIds.push(view.valuation.id);
        touched.add(view.valuation.snapshotId);
        valuationsMoved += 1;
        lines.push(
          `Balance ${day || "undated"}: move ${formatGbp(view.valuation.valueGbp)} onto ${target.name}.`
        );
      }
      continue;
    }

    const winner = chooseValuation(bucket);
    const keeper = targets[0];
    const replacedCarriedForward = keeper.valuation.isCarriedForward && !winner.valuation.isCarriedForward;
    if (
      keeper.valuation.valueNative !== winner.valuation.valueNative ||
      keeper.valuation.valueGbp !== winner.valuation.valueGbp ||
      keeper.valuation.isCarriedForward !== winner.valuation.isCarriedForward
    ) {
      keeperUpdates.push({
        id: keeper.valuation.id,
        valueNative: winner.valuation.valueNative,
        valueGbp: winner.valuation.valueGbp,
        isCarriedForward: winner.valuation.isCarriedForward,
      });
    }
    if (replacedCarriedForward) carriedForwardReplaced += 1;

    for (const view of sources) {
      deleteValuationIds.push(view.valuation.id);
      touched.add(view.valuation.snapshotId);
      valuationsDeduped += 1;
    }
    for (const view of targets.slice(1)) {
      deleteValuationIds.push(view.valuation.id);
      touched.add(view.valuation.snapshotId);
      valuationsDeduped += 1;
    }
    touched.add(keeper.valuation.snapshotId);
    const kept = replacedCarriedForward
      ? `kept imported ${formatGbp(winner.valuation.valueGbp)} instead of carried-forward ${formatGbp(keeper.valuation.valueGbp)}`
      : `kept ${formatGbp(winner.valuation.valueGbp)}`;
    lines.push(`Balance ${day}: overlap, ${kept}.`);
  }

  const targetTransactions = database
    .select()
    .from(transactions)
    .where(eq(transactions.accountId, target.id))
    .all();
  const sourceTransactions = database
    .select()
    .from(transactions)
    .where(eq(transactions.accountId, source.id))
    .all();
  const seen = new Set(targetTransactions.map((row) => transactionKey(target.id, row)));
  const moveTransactions: Plan["moveTransactions"] = [];
  const deleteTransactionIds: string[] = [];
  let transactionsMoved = 0;
  let transactionsDeduped = 0;

  for (const row of sourceTransactions) {
    const nextId = transactionKey(target.id, row);
    if (seen.has(nextId)) {
      deleteTransactionIds.push(row.id);
      transactionsDeduped += 1;
      lines.push(`Transaction ${row.date} ${row.descriptionRaw}: duplicate, drop.`);
      continue;
    }
    seen.add(nextId);
    moveTransactions.push({ id: row.id, nextId });
    transactionsMoved += 1;
    lines.push(
      `Transaction ${row.date} ${row.descriptionRaw}: move ${formatGbp(row.amountGbp)} (${row.statementMonth}).`
    );
  }

  const goalRows = database
    .select({ id: goals.id, name: goals.name })
    .from(goals)
    .where(eq(goals.linkedAccountId, source.id))
    .all();
  for (const goal of goalRows) {
    lines.push(`Goal “${goal.name}”: point at ${target.name}.`);
  }

  return {
    counts: {
      valuationsMoved,
      valuationsDeduped,
      carriedForwardReplaced,
      transactionsMoved,
      transactionsDeduped,
      goalsRelinked: goalRows.length,
      snapshotsRecomputed: touched.size,
    },
    lines,
    moveValuationIds,
    deleteValuationIds,
    keeperUpdates,
    moveTransactions,
    deleteTransactionIds,
    touchedSnapshots: [...touched],
    goalIds: goalRows.map((goal) => goal.id),
  };
}

function chooseValuation(bucket: ValuationView[]): ValuationView {
  return [...bucket].sort((a, b) => {
    const realDelta = Number(!b.valuation.isCarriedForward) - Number(!a.valuation.isCarriedForward);
    if (realDelta !== 0) return realDelta;
    const ownedDelta = Number(!b.fromSource) - Number(!a.fromSource);
    if (ownedDelta !== 0) return ownedDelta;
    return b.takenAt.localeCompare(a.takenAt);
  })[0];
}

function transactionKey(accountId: string, row: TransactionRow): string {
  return transactionFingerprint({
    accountId,
    date: row.date,
    amount: Math.abs(row.amountGbp),
    direction: row.direction,
    descriptionRaw: row.descriptionRaw,
    balanceAfter: row.balanceAfterGbp,
  });
}

function applyPlan(tx: Writer, sourceId: string, targetId: string, plan: Plan): void {
  for (const update of plan.keeperUpdates) {
    tx.update(accountValuations)
      .set({
        valueNative: update.valueNative,
        valueGbp: update.valueGbp,
        isCarriedForward: update.isCarriedForward,
      })
      .where(eq(accountValuations.id, update.id))
      .run();
  }
  for (const id of plan.deleteValuationIds) {
    tx.delete(accountValuations).where(eq(accountValuations.id, id)).run();
  }
  for (const id of plan.moveValuationIds) {
    tx.update(accountValuations)
      .set({ accountId: targetId })
      .where(eq(accountValuations.id, id))
      .run();
  }
  for (const id of plan.deleteTransactionIds) {
    tx.delete(transactions).where(eq(transactions.id, id)).run();
  }
  for (const move of plan.moveTransactions) {
    tx.update(transactions)
      .set({ id: move.nextId, accountId: targetId })
      .where(eq(transactions.id, move.id))
      .run();
  }
  for (const id of plan.goalIds) {
    tx.update(goals).set({ linkedAccountId: targetId }).where(eq(goals.id, id)).run();
  }
  recomputeSnapshots(tx, plan.touchedSnapshots);
  tx.delete(accounts).where(eq(accounts.id, sourceId)).run();
}

function recomputeSnapshots(tx: Writer, snapshotIds: string[]): void {
  if (snapshotIds.length === 0) return;
  const accountRows = tx.select({ id: accounts.id, type: accounts.type }).from(accounts).all();
  const typeById = new Map(accountRows.map((row) => [row.id, row.type]));
  for (const snapshotId of snapshotIds) {
    const vals = tx
      .select()
      .from(accountValuations)
      .where(eq(accountValuations.snapshotId, snapshotId))
      .all();
    let sum = 0;
    for (const valuation of vals) {
      const type = typeById.get(valuation.accountId);
      if (!type) continue;
      sum += type === "LIABILITY" ? -valuation.valueGbp : valuation.valueGbp;
    }
    const [snapshot] = tx.select().from(snapshots).where(eq(snapshots.id, snapshotId)).all();
    if (!snapshot) continue;
    const netWorthGbp = roundPence(sum + (snapshot.physicalAssetsGbp ?? 0));
    tx.update(snapshots).set({ netWorthGbp }).where(and(eq(snapshots.id, snapshotId))).run();
  }
}

function formatGbp(value: number): string {
  const absolute = Math.abs(value).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-£${absolute}` : `£${absolute}`;
}
