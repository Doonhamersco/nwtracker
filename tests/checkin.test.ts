/**
 * Check-in service tests.
 * Uses an in-memory SQLite DB. FX fetches are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetAllTables } from "./helpers/test-db";
import { randomUUID } from "crypto";
import { createTestDb } from "./helpers/test-db";
import {
  accounts,
  snapshots,
  accountValuations,
  fxRates,
  lifeMetricDefinitions,
  lifeMetricReadings,
} from "@/db/schema";
import { eq } from "drizzle-orm";

// ─── We test the service logic directly, injecting a test DB ─────────────────
// The checkin service imports db from @/db/client — we mock the whole module
// so tests don't touch the real data file.

// Mock the DB client before importing the service
vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  // Expose sqlite on the mock so tests can reset between runs
  return { db, _sqlite: sqlite };
});

// Mock FX fetchers to avoid real HTTP calls
vi.mock("@/lib/services/fx", () => ({
  fetchAllRatesForAccounts: vi.fn().mockResolvedValue(
    new Map([
      ["GBP", { fromCurrency: "GBP", toCurrency: "GBP", rate: 1, source: "manual" }],
      ["BTC", { fromCurrency: "BTC", toCurrency: "GBP", rate: 50000, source: "coingecko" }],
    ])
  ),
}));

const getStatsMock = vi.fn();
vi.mock("@/lib/hevy/client", () => ({
  hevyClient: {
    getStats: (...args: unknown[]) => getStatsMock(...args),
  },
  HevyApiError: class HevyApiError extends Error {},
}));

// Now import the service AFTER mocks are in place
const { buildCheckinDraft, commitCheckin, getSnapshotHistory, fillMissingHevyReadingsForLatestSnapshot } = await import(
  "@/lib/services/checkin"
);
const clientModule = await import("@/db/client");
const { db } = clientModule;
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

// ─── Reset DB between tests ───────────────────────────────────────────────────

beforeEach(() => {
  resetAllTables(sqlite);
  getStatsMock.mockReset();
  getStatsMock.mockRejectedValue(new Error("HEVY_API_KEY environment variable is not set."));
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function insertAccount(overrides: Partial<typeof accounts.$inferInsert> = {}) {
  const row = {
    id: randomUUID(),
    name: "Current Account",
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

function insertMetricDef(overrides: Partial<typeof lifeMetricDefinitions.$inferInsert> = {}) {
  const row = {
    id: randomUUID(),
    name: "Body Weight",
    unit: "kg",
    displayColor: "#6366f1",
    isBuiltin: true,
    isHevyMetric: false,
    sortOrder: 0,
    ...overrides,
  };
  db.insert(lifeMetricDefinitions).values(row).run();
  return row;
}

// ─── buildCheckinDraft ────────────────────────────────────────────────────────

describe("buildCheckinDraft — no prior snapshots", () => {
  it("returns all active accounts with null lastValueNative", async () => {
    insertAccount({ name: "Barclays", currencyCode: "GBP" });
    const draft = await buildCheckinDraft();

    const barclays = draft.accounts.find((a) => a.accountName === "Barclays");
    expect(barclays).toBeDefined();
    expect(barclays?.lastValueNative).toBeNull();
    expect(barclays?.isCarriedForward).toBe(false);
  });

  it("does not include inactive accounts", async () => {
    insertAccount({ name: "Closed Account", isActive: false });
    const draft = await buildCheckinDraft();

    const closed = draft.accounts.find((a) => a.accountName === "Closed Account");
    expect(closed).toBeUndefined();
  });

  it("returns metric definitions with null lastValue when no prior readings", async () => {
    insertMetricDef({ name: "Weight Test" });
    const draft = await buildCheckinDraft();

    const metric = draft.metrics.find((m) => m.metricName === "Weight Test");
    expect(metric).toBeDefined();
    expect(metric?.lastValue).toBeNull();
  });
});

describe("buildCheckinDraft — with prior snapshot", () => {
  it("pre-fills last known native values from prior snapshot", async () => {
    const account = insertAccount({ name: "ISA", currencyCode: "GBP" });

    // Create a prior committed snapshot
    const priorSnapshotId = randomUUID();
    db.insert(snapshots).values({
      id: priorSnapshotId,
      isPartial: false,
      netWorthGbp: 5000,
    }).run();
    db.insert(accountValuations).values({
      id: randomUUID(),
      snapshotId: priorSnapshotId,
      accountId: account.id,
      valueNative: 5000,
      valueGbp: 5000,
      isCarriedForward: false,
    }).run();

    const draft = await buildCheckinDraft();
    const isa = draft.accounts.find((a) => a.accountId === account.id);

    expect(isa?.lastValueNative).toBe(5000);
    expect(isa?.isCarriedForward).toBe(true);
  });

  it("pre-fills last known metric readings", async () => {
    const metric = insertMetricDef({ name: "Body Weight Prefill Test" });

    const priorSnapshotId = randomUUID();
    db.insert(snapshots).values({
      id: priorSnapshotId,
      isPartial: false,
      netWorthGbp: 0,
    }).run();
    db.insert(lifeMetricReadings).values({
      id: randomUUID(),
      snapshotId: priorSnapshotId,
      metricId: metric.id,
      value: 82.5,
    }).run();

    const draft = await buildCheckinDraft();
    const m = draft.metrics.find((x) => x.metricId === metric.id);
    expect(m?.lastValue).toBe(82.5);
  });

  it("uses the most recent committed snapshot, not a partial one", async () => {
    const account = insertAccount({ name: "Partial Test Account" });

    // Older committed snapshot: £3,000
    const oldId = randomUUID();
    db.insert(snapshots).values({ id: oldId, takenAt: "2024-01-01T00:00:00.000Z", isPartial: false, netWorthGbp: 3000 }).run();
    db.insert(accountValuations).values({
      id: randomUUID(), snapshotId: oldId, accountId: account.id,
      valueNative: 3000, valueGbp: 3000, isCarriedForward: false,
    }).run();

    // Newer PARTIAL snapshot: £4,000 — should be ignored for pre-fill
    const partialId = randomUUID();
    db.insert(snapshots).values({ id: partialId, takenAt: "2024-06-01T00:00:00.000Z", isPartial: true, netWorthGbp: 4000 }).run();
    db.insert(accountValuations).values({
      id: randomUUID(), snapshotId: partialId, accountId: account.id,
      valueNative: 4000, valueGbp: 4000, isCarriedForward: false,
    }).run();

    const draft = await buildCheckinDraft();
    const acc = draft.accounts.find((a) => a.accountId === account.id);
    expect(acc?.lastValueNative).toBe(3000);
  });
});

// ─── commitCheckin ────────────────────────────────────────────────────────────

describe("commitCheckin", () => {
  it("creates a snapshot with the correct materialised net worth", async () => {
    const asset = insertAccount({ name: "Asset Account", type: "ASSET", currencyCode: "GBP" });
    const liability = insertAccount({ name: "Student Loan", type: "LIABILITY", category: "STUDENT_LOAN", currencyCode: "GBP" });

    const result = await commitCheckin({
      valuations: [
        { accountId: asset.id, valueNative: 10000, isCarriedForward: false },
        { accountId: liability.id, valueNative: 3000, isCarriedForward: false },
      ],
      metrics: [],
      isPartial: false,
    });

    expect(result.netWorthGbp).toBeCloseTo(7000);
    expect(result.snapshotId).toBeDefined();

    const [saved] = db.select().from(snapshots).where(eq(snapshots.id, result.snapshotId)).all();
    expect(saved.netWorthGbp).toBeCloseTo(7000);
    expect(saved.isPartial).toBe(false);
  });

  it("stores value_gbp using the snapshot FX rate, not 1:1 for non-GBP", async () => {
    // BTC account — mock returns rate = 50000
    const btcAccount = insertAccount({
      name: "BTC Wallet",
      type: "ASSET",
      category: "CRYPTO",
      currencyCode: "BTC",
      coingeckoId: "bitcoin",
    });

    const result = await commitCheckin({
      valuations: [
        { accountId: btcAccount.id, valueNative: 0.5, isCarriedForward: false },
      ],
      metrics: [],
      isPartial: false,
    });

    // 0.5 BTC × £50,000 = £25,000
    expect(result.netWorthGbp).toBeCloseTo(25000);

    const [valuation] = db
      .select()
      .from(accountValuations)
      .where(eq(accountValuations.snapshotId, result.snapshotId))
      .all();
    expect(valuation.valueNative).toBe(0.5);
    expect(valuation.valueGbp).toBeCloseTo(25000);
  });

  it("stores FX rates for every unique currency used", async () => {
    const gbpAcc = insertAccount({ name: "GBP Acc", currencyCode: "GBP" });
    const btcAcc = insertAccount({ name: "BTC Acc", currencyCode: "BTC", coingeckoId: "bitcoin", category: "CRYPTO" });

    const result = await commitCheckin({
      valuations: [
        { accountId: gbpAcc.id, valueNative: 1000, isCarriedForward: false },
        { accountId: btcAcc.id, valueNative: 0.1, isCarriedForward: false },
      ],
      metrics: [],
      isPartial: false,
    });

    const rates = db
      .select()
      .from(fxRates)
      .where(eq(fxRates.snapshotId, result.snapshotId))
      .all();

    const gbpRate = rates.find((r) => r.fromCurrency === "GBP");
    const btcRate = rates.find((r) => r.fromCurrency === "BTC");

    expect(gbpRate?.rate).toBe(1);
    expect(btcRate?.rate).toBe(50000);
    expect(btcRate?.source).toBe("coingecko");
  });

  it("stores life metric readings with the snapshot", async () => {
    const account = insertAccount({ name: "Account For Metrics" });
    const metric = insertMetricDef({ name: "Weight For Commit Test" });

    const result = await commitCheckin({
      valuations: [{ accountId: account.id, valueNative: 1000, isCarriedForward: false }],
      metrics: [{ metricId: metric.id, value: 80.5, notes: "After workout" }],
      isPartial: false,
    });

    const [reading] = db
      .select()
      .from(lifeMetricReadings)
      .where(eq(lifeMetricReadings.snapshotId, result.snapshotId))
      .all();

    expect(reading.value).toBe(80.5);
    expect(reading.notes).toBe("After workout");
  });

  it("marks partial snapshots correctly", async () => {
    const account = insertAccount({ name: "Partial Account" });

    const result = await commitCheckin({
      valuations: [{ accountId: account.id, valueNative: 500, isCarriedForward: false }],
      metrics: [],
      isPartial: true,
    });

    const [saved] = db.select().from(snapshots).where(eq(snapshots.id, result.snapshotId)).all();
    expect(saved.isPartial).toBe(true);
  });

  it("rolls back entirely if a metric insert fails", async () => {
    const account = insertAccount({ name: "Rollback Test Account" });

    await expect(
      commitCheckin({
        valuations: [{ accountId: account.id, valueNative: 1000, isCarriedForward: false }],
        metrics: [
          // Non-existent metric ID — should trigger FK violation and roll back
          { metricId: "00000000-0000-0000-0000-000000000000", value: 80 },
        ],
        isPartial: false,
      })
    ).rejects.toThrow();

    // No snapshot should have been created
    const allSnapshots = db.select().from(snapshots).all();
    const snapshotWithValuation = allSnapshots.find((s) => {
      const vals = db.select().from(accountValuations).where(eq(accountValuations.snapshotId, s.id)).all();
      return vals.some((v) => v.accountId === account.id);
    });
    expect(snapshotWithValuation).toBeUndefined();
  });
});

// ─── getSnapshotHistory ───────────────────────────────────────────────────────

describe("getSnapshotHistory", () => {
  it("returns snapshots in descending order by date", async () => {
    db.insert(snapshots).values({ id: randomUUID(), takenAt: "2024-01-01T00:00:00.000Z", netWorthGbp: 10000, isPartial: false }).run();
    db.insert(snapshots).values({ id: randomUUID(), takenAt: "2024-06-01T00:00:00.000Z", netWorthGbp: 15000, isPartial: false }).run();
    db.insert(snapshots).values({ id: randomUUID(), takenAt: "2024-03-01T00:00:00.000Z", netWorthGbp: 12000, isPartial: false }).run();

    const history = getSnapshotHistory();

    const netWorths = history
      .filter((s) => s.netWorthGbp !== null && [10000, 12000, 15000].includes(s.netWorthGbp!))
      .map((s) => s.netWorthGbp);

    expect(netWorths[0]).toBe(15000);
    expect(netWorths[1]).toBe(12000);
    expect(netWorths[2]).toBe(10000);
  });
});

// ─── Hevy auto-sync ───────────────────────────────────────────────────────────

const mockHevyStats = {
  total_workouts: 120,
  workouts_this_week: 3,
  workouts_this_month: 8,
  workouts_last_30d: 11,
  avg_duration_minutes: 62,
  latest_weight_kg: 82.1,
  latest_weight_date: "2026-08-20",
  recent_volume: [
    { date: "2026-08-19", total_volume_kg: 5000, duration_minutes: 60, set_count: 20 },
    { date: "2026-08-18", total_volume_kg: 4000, duration_minutes: 55, set_count: 18 },
  ],
  last_workout_at: "2026-08-19T18:00:00.000Z",
};

function insertHevyMetrics() {
  const sessions = insertMetricDef({
    name: "Workout Sessions (30d)",
    unit: "sessions",
    isHevyMetric: true,
    sortOrder: 4,
  });
  const volume = insertMetricDef({
    name: "Training Volume (30d)",
    unit: "kg",
    isHevyMetric: true,
    sortOrder: 5,
  });
  const prs = insertMetricDef({
    name: "Personal Records (30d)",
    unit: "PRs",
    isHevyMetric: true,
    sortOrder: 6,
  });
  return { sessions, volume, prs };
}

describe("Hevy auto-sync", () => {
  it("pre-fills Hevy metric drafts from live stats", async () => {
    insertHevyMetrics();
    getStatsMock.mockResolvedValue(mockHevyStats);

    const draft = await buildCheckinDraft();
    const sessions = draft.metrics.find((m) => m.metricName.includes("Workout Sessions"));
    const volume = draft.metrics.find((m) => m.metricName.includes("Training Volume"));
    const prs = draft.metrics.find((m) => m.metricName.includes("Personal Records"));

    expect(sessions?.lastValue).toBe(11);
    expect(volume?.lastValue).toBe(9000);
    expect(prs?.lastValue).toBe(0);
  });

  it("writes Hevy readings on commit even if the client omitted them", async () => {
    const account = insertAccount({ name: "Hevy Commit Account" });
    const { sessions, volume, prs } = insertHevyMetrics();
    getStatsMock.mockResolvedValue(mockHevyStats);

    const result = await commitCheckin({
      valuations: [{ accountId: account.id, valueNative: 1000, isCarriedForward: false }],
      metrics: [],
      isPartial: false,
    });

    const readings = db
      .select()
      .from(lifeMetricReadings)
      .where(eq(lifeMetricReadings.snapshotId, result.snapshotId))
      .all();

    expect(readings.find((r) => r.metricId === sessions.id)?.value).toBe(11);
    expect(readings.find((r) => r.metricId === volume.id)?.value).toBe(9000);
    expect(readings.find((r) => r.metricId === prs.id)?.value).toBe(0);
  });

  it("repairs a recent snapshot that is missing Hevy readings", async () => {
    const { sessions, volume } = insertHevyMetrics();
    getStatsMock.mockResolvedValue(mockHevyStats);

    const snapshotId = randomUUID();
    db.insert(snapshots)
      .values({
        id: snapshotId,
        takenAt: new Date().toISOString(),
        isPartial: false,
        netWorthGbp: 1000,
      })
      .run();

    const filled = await fillMissingHevyReadingsForLatestSnapshot();
    expect(filled).toBe(true);

    const readings = db
      .select()
      .from(lifeMetricReadings)
      .where(eq(lifeMetricReadings.snapshotId, snapshotId))
      .all();

    expect(readings.find((r) => r.metricId === sessions.id)?.value).toBe(11);
    expect(readings.find((r) => r.metricId === volume.id)?.value).toBe(9000);
  });

  it("does not overwrite Hevy readings that are already present", async () => {
    const { sessions } = insertHevyMetrics();
    getStatsMock.mockResolvedValue(mockHevyStats);

    const snapshotId = randomUUID();
    db.insert(snapshots)
      .values({
        id: snapshotId,
        takenAt: new Date().toISOString(),
        isPartial: false,
        netWorthGbp: 1000,
      })
      .run();
    db.insert(lifeMetricReadings)
      .values({
        id: randomUUID(),
        snapshotId,
        metricId: sessions.id,
        value: 4,
      })
      .run();

    const filled = await fillMissingHevyReadingsForLatestSnapshot();
    expect(filled).toBe(false);

    const [reading] = db
      .select()
      .from(lifeMetricReadings)
      .where(eq(lifeMetricReadings.snapshotId, snapshotId))
      .all();
    expect(reading.value).toBe(4);
  });
});
