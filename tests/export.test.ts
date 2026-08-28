import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetAllTables } from "./helpers/test-db";
import { randomUUID } from "crypto";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const clientModule = await import("@/db/client");
const { db } = clientModule;
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

const { exportToJson, exportToCsv, EXPORT_SCHEMA_VERSION } = await import("@/lib/services/export");

import {
  accounts,
  snapshots,
  accountValuations,
  goals,
  lifeMetricDefinitions,
  subscriptions,
} from "@/db/schema";

beforeEach(() => {
  resetAllTables(sqlite);
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function insertAccount(name = "Test Account", type: "ASSET" | "LIABILITY" = "ASSET") {
  const id = randomUUID();
  db.insert(accounts).values({
    id,
    name,
    type,
    category: "CASH",
    currencyCode: "GBP",
    isActive: true,
    sortOrder: 0,
  }).run();
  return id;
}

function insertSnapshot(netWorthGbp: number, takenAt: string) {
  const id = randomUUID();
  db.insert(snapshots).values({ id, takenAt, netWorthGbp, isPartial: false }).run();
  return id;
}

function insertValuation(snapshotId: string, accountId: string, valueNative: number, valueGbp: number) {
  const id = randomUUID();
  db.insert(accountValuations).values({
    id,
    snapshotId,
    accountId,
    valueNative,
    valueGbp,
    isCarriedForward: false,
  }).run();
  return id;
}

// ─── exportToJson ─────────────────────────────────────────────────────────────

describe("exportToJson", () => {
  it("includes all entities with correct schemaVersion", () => {
    const accountId = insertAccount("Export Account");
    const snapshotId = insertSnapshot(50000, "2024-01-01T00:00:00.000Z");
    insertValuation(snapshotId, accountId, 50000, 50000);

    db.insert(goals).values({
      id: randomUUID(),
      name: "Test Goal",
      targetValue: 100000,
      targetDate: "2030-01-01",
      metricType: "NET_WORTH",
      isActive: true,
    }).run();

    db.insert(subscriptions).values({
      id: randomUUID(),
      name: "Netflix",
      costGbp: 15.99,
      billingCycle: "monthly",
      category: "entertainment",
      status: "active",
    }).run();

    const payload = exportToJson();

    expect(payload.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(typeof payload.exportedAt).toBe("string");

    expect(payload.accounts.length).toBeGreaterThanOrEqual(1);
    expect(payload.snapshots.length).toBeGreaterThanOrEqual(1);
    expect(payload.valuations.length).toBeGreaterThanOrEqual(1);
    expect(payload.goals.length).toBeGreaterThanOrEqual(1);
    expect(payload.subscriptions.length).toBeGreaterThanOrEqual(1);
    expect(payload.subscriptions.find((s) => s.name === "Netflix")).toBeDefined();

    expect(payload.accounts.find((a) => a.id === accountId)).toBeDefined();
    expect(payload.snapshots.find((s) => s.id === snapshotId)).toBeDefined();
  });

  it("includes all entity types even when empty", () => {
    const payload = exportToJson();

    expect(Array.isArray(payload.accounts)).toBe(true);
    expect(Array.isArray(payload.snapshots)).toBe(true);
    expect(Array.isArray(payload.valuations)).toBe(true);
    expect(Array.isArray(payload.fxRates)).toBe(true);
    expect(Array.isArray(payload.lifeMetricDefinitions)).toBe(true);
    expect(Array.isArray(payload.lifeMetricReadings)).toBe(true);
    expect(Array.isArray(payload.goals)).toBe(true);
    expect(Array.isArray(payload.subscriptions)).toBe(true);
  });
});

// ─── exportToCsv ──────────────────────────────────────────────────────────────

describe("exportToCsv", () => {
  it("produces correct headers", () => {
    const csv = exportToCsv();
    const firstLine = csv.split("\n")[0];

    expect(firstLine).toContain("snapshot_date");
    expect(firstLine).toContain("account_name");
    expect(firstLine).toContain("account_type");
    expect(firstLine).toContain("account_category");
    expect(firstLine).toContain("currency_code");
    expect(firstLine).toContain("value_native");
    expect(firstLine).toContain("value_gbp");
    expect(firstLine).toContain("is_carried_forward");
    expect(firstLine).toContain("snapshot_net_worth_gbp");
  });

  it("row count = number of account valuations across all snapshots", () => {
    const acc1 = insertAccount("Account 1");
    const acc2 = insertAccount("Account 2");
    const snap1 = insertSnapshot(5000, "2024-01-01T00:00:00.000Z");
    const snap2 = insertSnapshot(6000, "2024-06-01T00:00:00.000Z");

    // 2 accounts x 2 snapshots = 4 valuations
    insertValuation(snap1, acc1, 2500, 2500);
    insertValuation(snap1, acc2, 2500, 2500);
    insertValuation(snap2, acc1, 3000, 3000);
    insertValuation(snap2, acc2, 3000, 3000);

    const csv = exportToCsv();
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    // +1 for header row
    expect(lines.length).toBe(5);
  });

  it("returns only header when no valuations exist", () => {
    const csv = exportToCsv();
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    expect(lines.length).toBe(1);
  });
});
