/**
 * Snapshot integrity tests.
 * Verifies the append-only invariant and unique constraints at the DB level.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./helpers/test-db";
import { accounts, snapshots, accountValuations, fxRates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

let db: ReturnType<typeof createTestDb>["db"];
let sqlite: ReturnType<typeof createTestDb>["sqlite"];

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
});

// ─── Fixture helpers ────────────────────────────────────────────────────────

function seedAccount(overrides?: Partial<typeof accounts.$inferInsert>) {
  const row = {
    id: randomUUID(),
    name: "Test Account",
    type: "ASSET" as const,
    category: "CASH" as const,
    currencyCode: "GBP",
    isActive: true,
    sortOrder: 0,
    ...overrides,
  };
  db.insert(accounts).values(row).run();
  return row;
}

function seedSnapshot(overrides?: Partial<typeof snapshots.$inferInsert>) {
  const row = {
    id: randomUUID(),
    notes: null,
    isPartial: false,
    netWorthGbp: null,
    ...overrides,
  };
  db.insert(snapshots).values(row).run();
  return row;
}

function seedValuation(
  snapshotId: string,
  accountId: string,
  overrides?: Partial<typeof accountValuations.$inferInsert>
) {
  const row = {
    id: randomUUID(),
    snapshotId,
    accountId,
    valueNative: 1000,
    valueGbp: 1000,
    isCarriedForward: false,
    ...overrides,
  };
  db.insert(accountValuations).values(row).run();
  return row;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Unique constraint: one valuation per account per snapshot", () => {
  it("allows one valuation per (snapshot, account) pair", () => {
    const account = seedAccount();
    const snapshot = seedSnapshot();
    expect(() => seedValuation(snapshot.id, account.id)).not.toThrow();
  });

  it("rejects a second valuation for the same account in the same snapshot", () => {
    const account = seedAccount();
    const snapshot = seedSnapshot();
    seedValuation(snapshot.id, account.id);
    expect(() => seedValuation(snapshot.id, account.id)).toThrow();
  });

  it("allows the same account to appear in two different snapshots", () => {
    const account = seedAccount();
    const s1 = seedSnapshot();
    const s2 = seedSnapshot();
    expect(() => seedValuation(s1.id, account.id)).not.toThrow();
    expect(() => seedValuation(s2.id, account.id)).not.toThrow();
  });
});

describe("Foreign key: account_valuations → snapshots", () => {
  it("rejects a valuation pointing to a non-existent snapshot", () => {
    const account = seedAccount();
    expect(() =>
      seedValuation("non-existent-snapshot-id", account.id)
    ).toThrow();
  });
});

describe("Foreign key: account_valuations → accounts", () => {
  it("rejects a valuation pointing to a non-existent account", () => {
    const snapshot = seedSnapshot();
    expect(() =>
      seedValuation(snapshot.id, "non-existent-account-id")
    ).toThrow();
  });
});

describe("Cascade delete: snapshot → valuations", () => {
  it("deletes valuations when their snapshot is deleted", () => {
    const account = seedAccount();
    const snapshot = seedSnapshot();
    seedValuation(snapshot.id, account.id);

    db.delete(snapshots).where(eq(snapshots.id, snapshot.id)).run();

    const remaining = db
      .select()
      .from(accountValuations)
      .where(eq(accountValuations.snapshotId, snapshot.id))
      .all();
    expect(remaining).toHaveLength(0);
  });
});

describe("Restrict delete: account referenced by valuation", () => {
  it("prevents deleting an account that has valuations", () => {
    const account = seedAccount();
    const snapshot = seedSnapshot();
    seedValuation(snapshot.id, account.id);

    expect(() =>
      db.delete(accounts).where(eq(accounts.id, account.id)).run()
    ).toThrow();
  });
});

describe("FX rates unique constraint", () => {
  it("allows one FX rate per currency pair per snapshot", () => {
    const snapshot = seedSnapshot();
    expect(() =>
      db.insert(fxRates).values({
        id: randomUUID(),
        snapshotId: snapshot.id,
        fromCurrency: "USD",
        toCurrency: "GBP",
        rate: 0.79,
        source: "frankfurter",
      }).run()
    ).not.toThrow();
  });

  it("rejects a duplicate FX rate for the same pair in the same snapshot", () => {
    const snapshot = seedSnapshot();
    const base = {
      snapshotId: snapshot.id,
      fromCurrency: "USD",
      toCurrency: "GBP",
      rate: 0.79,
      source: "frankfurter" as const,
    };
    db.insert(fxRates).values({ id: randomUUID(), ...base }).run();
    expect(() =>
      db.insert(fxRates).values({ id: randomUUID(), ...base }).run()
    ).toThrow();
  });
});

describe("Snapshot immutability (application-level)", () => {
  it("net_worth_gbp stored at commit time is independent of later FX changes", () => {
    const account = seedAccount({ currencyCode: "BTC", category: "CRYPTO" });

    // June snapshot: 0.5 BTC at £40,000 → £20,000
    const juneSnapshot = seedSnapshot({ netWorthGbp: 20000 });
    seedValuation(juneSnapshot.id, account.id, {
      valueNative: 0.5,
      valueGbp: 20000,
    });
    db.insert(fxRates)
      .values({
        id: randomUUID(),
        snapshotId: juneSnapshot.id,
        fromCurrency: "BTC",
        toCurrency: "GBP",
        rate: 40000,
        source: "coingecko",
      })
      .run();

    // December snapshot: same BTC amount but BTC doubled to £80,000
    const decSnapshot = seedSnapshot({ netWorthGbp: 40000 });
    seedValuation(decSnapshot.id, account.id, {
      valueNative: 0.5,
      valueGbp: 40000,
    });
    db.insert(fxRates)
      .values({
        id: randomUUID(),
        snapshotId: decSnapshot.id,
        fromCurrency: "BTC",
        toCurrency: "GBP",
        rate: 80000,
        source: "coingecko",
      })
      .run();

    // Read June snapshot directly from DB — must still be £20,000
    const [june] = db
      .select({ netWorthGbp: snapshots.netWorthGbp })
      .from(snapshots)
      .where(eq(snapshots.id, juneSnapshot.id))
      .all();

    const [june_val] = db
      .select({ valueGbp: accountValuations.valueGbp })
      .from(accountValuations)
      .where(eq(accountValuations.snapshotId, juneSnapshot.id))
      .all();

    const [june_fx] = db
      .select({ rate: fxRates.rate })
      .from(fxRates)
      .where(eq(fxRates.snapshotId, juneSnapshot.id))
      .all();

    expect(june.netWorthGbp).toBe(20000);
    expect(june_val.valueGbp).toBe(20000);
    expect(june_fx.rate).toBe(40000);
  });
});
