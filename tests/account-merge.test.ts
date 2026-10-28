import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { resetAllTables } from "./helpers/test-db";
import { transactionFingerprint } from "@/lib/spending/hash";
import { accountValuations, accounts, goals, snapshots, transactions } from "@/db/schema";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const clientModule = await import("@/db/client");
const { db } = clientModule;
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;
const { mergeAccounts } = await import("@/lib/services/account-merge");

beforeEach(() => {
  resetAllTables(sqlite);
});

function insertAccount(name: string, type: "ASSET" | "LIABILITY" = "ASSET") {
  const id = randomUUID();
  db.insert(accounts)
    .values({
      id,
      name,
      type,
      category: type === "LIABILITY" ? "OTHER_LIABILITY" : "CASH",
      currencyCode: "GBP",
      wrapper: "NONE",
      isActive: true,
      sortOrder: 0,
    })
    .run();
  return id;
}

function insertSnapshot(takenAt: string, netWorthGbp: number) {
  const id = randomUUID();
  db.insert(snapshots)
    .values({ id, takenAt, netWorthGbp, isPartial: false, physicalAssetsGbp: 0 })
    .run();
  return id;
}

function insertValuation(
  snapshotId: string,
  accountId: string,
  valueGbp: number,
  isCarriedForward: boolean
) {
  db.insert(accountValuations)
    .values({
      id: randomUUID(),
      snapshotId,
      accountId,
      valueNative: valueGbp,
      valueGbp,
      isCarriedForward,
    })
    .run();
}

function insertTransaction(
  accountId: string,
  input: { date: string; description: string; amountGbp: number; balance: number }
) {
  const direction = input.amountGbp < 0 ? "out" : "in";
  const id = transactionFingerprint({
    accountId,
    date: input.date,
    amount: Math.abs(input.amountGbp),
    direction,
    descriptionRaw: input.description,
    balanceAfter: input.balance,
  });
  db.insert(transactions)
    .values({
      id,
      accountId,
      date: input.date,
      descriptionRaw: input.description,
      merchant: input.description,
      amountGbp: input.amountGbp,
      direction,
      type: "card",
      balanceAfterGbp: input.balance,
      isTransfer: false,
      statementMonth: input.date.slice(0, 7),
      importBatchId: randomUUID(),
    })
    .run();
  return id;
}

describe("mergeAccounts", () => {
  it("moves history onto the target and drops the source", () => {
    const target = insertAccount("Chase UK");
    const source = insertAccount("Chase Bank Account");
    const other = insertAccount("ISA");
    const older = insertSnapshot("2026-08-01 12:00:00", 15000);
    const latest = insertSnapshot("2026-09-01 12:00:00", 13802);
    insertValuation(older, target, 4000, false);
    insertValuation(older, other, 11000, false);
    insertValuation(latest, target, 3800, true);
    insertValuation(latest, source, 2, false);
    insertValuation(latest, other, 10000, false);
    insertTransaction(source, { date: "2026-09-02", description: "TESCO", amountGbp: -12.4, balance: 3787.6 });
    const goalId = randomUUID();
    db.insert(goals)
      .values({
        id: goalId,
        name: "Chase buffer",
        targetValue: 5000,
        targetDate: "2027-01-01",
        metricType: "NET_WORTH",
        direction: "increase",
        linkedAccountId: source,
        isActive: true,
      })
      .run();

    const report = mergeAccounts({ sourceId: source, targetId: target });

    expect(report.status).toBe("merged");
    expect(report.valuationsMoved).toBe(0);
    expect(report.valuationsDeduped).toBe(1);
    expect(report.carriedForwardReplaced).toBe(1);
    expect(report.transactionsMoved).toBe(1);
    expect(report.goalsRelinked).toBe(1);
    expect(report.sourceDeleted).toBe(true);
    expect(db.select().from(accounts).where(eq(accounts.id, source)).all()).toEqual([]);

    const latestVals = db
      .select()
      .from(accountValuations)
      .where(eq(accountValuations.snapshotId, latest))
      .all();
    expect(
      latestVals
        .map((row) => [row.accountId, row.valueGbp, row.isCarriedForward])
        .sort((a, b) => Number(a[1]) - Number(b[1]))
    ).toEqual([
      [target, 2, false],
      [other, 10000, false],
    ]);
    expect(db.select().from(snapshots).where(eq(snapshots.id, latest)).all()[0].netWorthGbp).toBeCloseTo(10002);

    const olderTarget = db
      .select()
      .from(accountValuations)
      .where(eq(accountValuations.snapshotId, older))
      .all()
      .find((row) => row.accountId === target);
    expect(olderTarget?.valueGbp).toBe(4000);

    expect(db.select().from(transactions).all().map((row) => row.accountId)).toEqual([target]);
    expect(db.select().from(goals).where(eq(goals.id, goalId)).all()[0].linkedAccountId).toBe(target);
  });

  it("moves a balance onto a day the target does not have", () => {
    const target = insertAccount("Chase UK");
    const source = insertAccount("Chase Bank Account");
    const onlySource = insertSnapshot("2026-07-01 12:00:00", 900);
    insertValuation(onlySource, source, 900, false);

    const report = mergeAccounts({ sourceName: "chase bank account", targetName: "Chase UK" });

    expect(report.valuationsMoved).toBe(1);
    const [row] = db.select().from(accountValuations).all();
    expect(row.accountId).toBe(target);
    expect(row.valueGbp).toBe(900);
  });

  it("keeps the target when both balances for that day were entered", () => {
    const target = insertAccount("Chase UK");
    const source = insertAccount("Chase Bank Account");
    const day = insertSnapshot("2026-09-01 12:00:00", 6000);
    insertValuation(day, target, 5000, false);
    insertValuation(day, source, 1000, false);

    const report = mergeAccounts({ sourceId: source, targetId: target });

    expect(report.carriedForwardReplaced).toBe(0);
    expect(report.valuationsDeduped).toBe(1);
    const [row] = db.select().from(accountValuations).all();
    expect(row.accountId).toBe(target);
    expect(row.valueGbp).toBe(5000);
    expect(db.select().from(snapshots).all()[0].netWorthGbp).toBeCloseTo(5000);
  });

  it("collapses two snapshots on the same date and prefers the imported balance", () => {
    const target = insertAccount("Chase UK");
    const source = insertAccount("Chase Bank Account");
    const morning = insertSnapshot("2026-09-28 08:00:00", 3800);
    const evening = insertSnapshot("2026-09-28 18:00:00", 2);
    insertValuation(morning, target, 3800, true);
    insertValuation(evening, source, 2, false);

    mergeAccounts({ sourceId: source, targetId: target });

    const remaining = db.select().from(accountValuations).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].accountId).toBe(target);
    expect(remaining[0].valueGbp).toBe(2);
    expect(remaining[0].isCarriedForward).toBe(false);
    expect(db.select().from(snapshots).where(eq(snapshots.id, morning)).all()[0].netWorthGbp).toBeCloseTo(2);
    expect(db.select().from(snapshots).where(eq(snapshots.id, evening)).all()[0].netWorthGbp).toBeCloseTo(0);
  });

  it("drops a duplicate statement line and keeps a distinct one", () => {
    const target = insertAccount("Chase UK");
    const source = insertAccount("Chase Bank Account");
    insertTransaction(target, { date: "2026-09-02", description: "TESCO", amountGbp: -12.4, balance: 100 });
    insertTransaction(source, { date: "2026-09-02", description: "TESCO", amountGbp: -12.4, balance: 100 });
    insertTransaction(source, { date: "2026-09-03", description: "RENT", amountGbp: -800, balance: 3000 });

    const report = mergeAccounts({ sourceId: source, targetId: target });

    expect(report.transactionsMoved).toBe(1);
    expect(report.transactionsDeduped).toBe(1);
    const rows = db.select().from(transactions).all();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.accountId === target)).toBe(true);
    expect(rows.map((row) => row.descriptionRaw).sort()).toEqual(["RENT", "TESCO"]);
  });

  it("does not write anything during a dry run and is a no-op once the source is gone", () => {
    const target = insertAccount("Chase UK");
    const source = insertAccount("Chase Bank Account");
    const snapshotId = insertSnapshot("2026-09-01 12:00:00", 2);
    insertValuation(snapshotId, source, 2, false);

    const preview = mergeAccounts({ sourceId: source, targetId: target, dryRun: true });
    expect(preview.dryRun).toBe(true);
    expect(preview.valuationsMoved).toBe(1);
    expect(preview.sourceDeleted).toBe(false);
    expect(db.select().from(accounts).all()).toHaveLength(2);
    expect(db.select().from(accountValuations).all()[0].accountId).toBe(source);

    mergeAccounts({ sourceId: source, targetId: target });
    const again = mergeAccounts({ sourceId: source, targetId: target });
    expect(again.status).toBe("nothing-to-merge");
    expect(db.select().from(accountValuations).all()[0].accountId).toBe(target);
  });

  it("refuses to merge different account kinds and leaves both in place", () => {
    const target = insertAccount("Chase UK");
    const source = insertAccount("Student loan", "LIABILITY");
    const report = mergeAccounts({ sourceId: source, targetId: target });
    expect(report.status).toBe("refused");
    expect(db.select().from(accounts).all()).toHaveLength(2);
  });
});
