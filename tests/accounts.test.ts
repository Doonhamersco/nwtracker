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

const { listAccounts, createAccount, updateAccount, archiveAccount, reorderAccounts } =
  await import("@/lib/services/accounts");

import { accounts, accountValuations, snapshots } from "@/db/schema";

beforeEach(() => {
  resetAllTables(sqlite);
});

describe("createAccount", () => {
  it("inserts with correct defaults", () => {
    const row = createAccount({
      name: "Current Account",
      type: "ASSET",
      category: "CASH",
    });

    expect(row.id).toBeDefined();
    expect(row.name).toBe("Current Account");
    expect(row.type).toBe("ASSET");
    expect(row.category).toBe("CASH");
    expect(row.currencyCode).toBe("GBP");
    expect(row.isActive).toBe(true);
    expect(row.sortOrder).toBe(0);
    expect(row.wrapper).toBe("NONE");
    expect(row.coingeckoId).toBeNull();
    expect(row.institution).toBeNull();
    expect(row.notes).toBeNull();
  });

  it("stores custom fields", () => {
    const row = createAccount({
      name: "BTC Wallet",
      type: "ASSET",
      category: "CRYPTO",
      currencyCode: "BTC",
      coingeckoId: "bitcoin",
      institution: "Self-custody",
      notes: "Cold storage",
      sortOrder: 5,
    });

    expect(row.currencyCode).toBe("BTC");
    expect(row.coingeckoId).toBe("bitcoin");
    expect(row.institution).toBe("Self-custody");
    expect(row.notes).toBe("Cold storage");
    expect(row.sortOrder).toBe(5);
    expect(row.wrapper).toBe("NONE");
  });

  it("stores a SIPP wrapper", () => {
    const row = createAccount({
      name: "Vanguard SIPP",
      type: "ASSET",
      category: "STOCKS",
      wrapper: "SIPP",
    });
    expect(row.wrapper).toBe("SIPP");
  });
});

describe("listAccounts", () => {
  it("returns only active accounts by default", () => {
    createAccount({ name: "Active", type: "ASSET", category: "CASH" });
    createAccount({ name: "Also Active", type: "ASSET", category: "ISA" });

    const inactiveId = randomUUID();
    db.insert(accounts).values({
      id: inactiveId,
      name: "Inactive",
      type: "ASSET",
      category: "CASH",
      currencyCode: "GBP",
      isActive: false,
      sortOrder: 99,
    }).run();

    const active = listAccounts();
    expect(active.some((a) => a.name === "Inactive")).toBe(false);
    expect(active.length).toBeGreaterThanOrEqual(2);
  });

  it("returns all accounts when includeInactive = true", () => {
    createAccount({ name: "Active Account", type: "ASSET", category: "CASH" });
    const inactiveId = randomUUID();
    db.insert(accounts).values({
      id: inactiveId,
      name: "Inactive Account",
      type: "ASSET",
      category: "CASH",
      currencyCode: "GBP",
      isActive: false,
      sortOrder: 0,
    }).run();

    const all = listAccounts(true);
    expect(all.some((a) => a.name === "Inactive Account")).toBe(true);
  });
});

describe("archiveAccount", () => {
  it("sets isActive = false (does not delete)", () => {
    const row = createAccount({ name: "To Archive", type: "ASSET", category: "CASH" });

    archiveAccount(row.id);

    const [found] = db.select().from(accounts).all().filter((a) => a.id === row.id);
    expect(found).toBeDefined();
    expect(found.isActive).toBe(false);
  });

  it("throws if account not found", () => {
    expect(() => archiveAccount("00000000-0000-0000-0000-000000000000")).toThrow(
      "not found"
    );
  });
});

describe("updateAccount", () => {
  it("changes only the specified fields", () => {
    const row = createAccount({ name: "Old Name", type: "ASSET", category: "CASH" });

    const updated = updateAccount(row.id, { name: "New Name", notes: "Updated notes" });

    expect(updated.name).toBe("New Name");
    expect(updated.notes).toBe("Updated notes");
    expect(updated.type).toBe("ASSET");
    expect(updated.category).toBe("CASH");
  });

  it("throws if account not found", () => {
    expect(() =>
      updateAccount("00000000-0000-0000-0000-000000000000", { name: "Ghost" })
    ).toThrow("not found");
  });
});

describe("reorderAccounts", () => {
  it("updates sortOrder for each account in the given order", () => {
    const a = createAccount({ name: "Account A", type: "ASSET", category: "CASH" });
    const b = createAccount({ name: "Account B", type: "ASSET", category: "ISA" });
    const c = createAccount({ name: "Account C", type: "LIABILITY", category: "STUDENT_LOAN" });

    reorderAccounts([c.id, a.id, b.id]);

    const all = db.select().from(accounts).all();
    const aRow = all.find((x) => x.id === a.id)!;
    const bRow = all.find((x) => x.id === b.id)!;
    const cRow = all.find((x) => x.id === c.id)!;

    expect(cRow.sortOrder).toBe(0);
    expect(aRow.sortOrder).toBe(1);
    expect(bRow.sortOrder).toBe(2);
  });
});
