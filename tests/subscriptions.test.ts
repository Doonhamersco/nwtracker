import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetAllTables } from "./helpers/test-db";
import os from "os";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const clientModule = await import("@/db/client");
const { db } = clientModule;
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

let tmpDir: string;

beforeEach(() => {
  resetAllTables(sqlite);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nwtracker-subs-"));
  process.env.DATA_DIR = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.DATA_DIR;
});

const {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  listSubscriptions,
  getSubscriptionById,
  monthlyEquivalent,
  activeMonthlyTotal,
} = await import("@/lib/services/subscriptions");
const { saveFile } = await import("@/lib/services/files");
import { files } from "@/db/schema";

function createNetflix() {
  return createSubscription({
    name: "Netflix",
    costGbp: 15.99,
    billingCycle: "monthly",
    nextRenewalDate: "2026-09-01",
    category: "entertainment",
  });
}

describe("monthlyEquivalent", () => {
  it("returns monthly cost unchanged", () => {
    expect(monthlyEquivalent(12, "monthly")).toBe(12);
  });

  it("divides yearly cost by 12", () => {
    expect(monthlyEquivalent(120, "yearly")).toBe(10);
  });
});

describe("activeMonthlyTotal", () => {
  it("sums active subs and ignores cancelled", () => {
    const total = activeMonthlyTotal([
      { status: "active", costGbp: 12, billingCycle: "monthly" },
      { status: "active", costGbp: 120, billingCycle: "yearly" },
      { status: "cancelled", costGbp: 50, billingCycle: "monthly" },
    ]);
    expect(total).toBe(22);
  });
});

describe("createSubscription", () => {
  it("inserts an active subscription by default", () => {
    const row = createNetflix();

    expect(row.id).toBeDefined();
    expect(row.name).toBe("Netflix");
    expect(row.costGbp).toBe(15.99);
    expect(row.billingCycle).toBe("monthly");
    expect(row.nextRenewalDate).toBe("2026-09-01");
    expect(row.category).toBe("entertainment");
    expect(row.status).toBe("active");
    expect(row.cancelledAt).toBeNull();
  });

  it("sets cancelledAt when created as cancelled", () => {
    const row = createSubscription({
      name: "Gym",
      costGbp: 40,
      billingCycle: "monthly",
      category: "fitness",
      status: "cancelled",
    });

    expect(row.status).toBe("cancelled");
    expect(row.cancelledAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("updateSubscription", () => {
  it("updates fields", () => {
    const row = createNetflix();
    const updated = updateSubscription(row.id, {
      name: "Netflix Premium",
      costGbp: 19.99,
    });

    expect(updated.name).toBe("Netflix Premium");
    expect(updated.costGbp).toBe(19.99);
  });

  it("stamps cancelledAt when cancelling", () => {
    const row = createNetflix();
    const updated = updateSubscription(row.id, { status: "cancelled" });

    expect(updated.status).toBe("cancelled");
    expect(updated.cancelledAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("clears cancelledAt when reactivating", () => {
    const row = createSubscription({
      name: "Gym",
      costGbp: 40,
      billingCycle: "monthly",
      category: "fitness",
      status: "cancelled",
    });

    const updated = updateSubscription(row.id, { status: "active" });
    expect(updated.status).toBe("active");
    expect(updated.cancelledAt).toBeNull();
  });

  it("throws when id does not exist", () => {
    expect(() =>
      updateSubscription(randomUUID(), { name: "Missing" })
    ).toThrow(/not found/);
  });
});

describe("listSubscriptions / getSubscriptionById", () => {
  it("returns subscriptions with files", () => {
    const row = createNetflix();
    const listed = listSubscriptions();
    expect(listed).toHaveLength(1);
    expect(listed[0].subscription.id).toBe(row.id);
    expect(listed[0].files).toEqual([]);

    const fetched = getSubscriptionById(row.id);
    expect(fetched?.subscription.name).toBe("Netflix");
  });

  it("returns null for unknown id", () => {
    expect(getSubscriptionById(randomUUID())).toBeNull();
  });
});

describe("deleteSubscription", () => {
  it("removes the row and linked logo files", () => {
    const row = createNetflix();
    saveFile({
      displayName: "logo.png",
      mimeType: "image/png",
      data: Buffer.from("png"),
      linkedToType: "SUBSCRIPTION",
      linkedToId: row.id,
    });

    deleteSubscription(row.id);

    expect(getSubscriptionById(row.id)).toBeNull();
    expect(db.select().from(files).all()).toHaveLength(0);
  });
});
