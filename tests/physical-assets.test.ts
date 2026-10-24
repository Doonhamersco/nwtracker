import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAllTables } from "./helpers/test-db";
import { physicalAssets } from "@/db/schema";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const {
  createPhysicalAsset,
  deletePhysicalAsset,
  listPhysicalAssets,
  totalPhysicalAssetsGbp,
  updatePhysicalAsset,
} = await import("@/lib/services/physical-assets");
const { POST, GET } = await import("@/app/api/physical-assets/route");
const { PATCH, DELETE } = await import("@/app/api/physical-assets/[id]/route");

const clientModule = await import("@/db/client");
const { db } = clientModule;
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

beforeEach(() => {
  resetAllTables(sqlite);
});

describe("physical assets", () => {
  it("creates, updates, lists, and removes an asset", () => {
    const created = createPhysicalAsset({
      name: "Example car",
      category: "vehicle",
      valueGbp: 8500,
      purchaseDate: "2020-05-01",
      purchasePriceGbp: 12000,
      notes: "Bought outright",
    });

    expect(created.name).toBe("Example car");
    expect(created.category).toBe("vehicle");
    expect(created.valueGbp).toBe(8500);
    expect(totalPhysicalAssetsGbp()).toBe(8500);

    const updated = updatePhysicalAsset(created.id, { valueGbp: 8000, notes: null });
    expect(updated.valueGbp).toBe(8000);
    expect(updated.notes).toBeNull();
    expect(listPhysicalAssets()).toHaveLength(1);
    expect(totalPhysicalAssetsGbp()).toBe(8000);

    deletePhysicalAsset(created.id);
    expect(listPhysicalAssets()).toEqual([]);
    expect(totalPhysicalAssetsGbp()).toBe(0);
    expect(db.select().from(physicalAssets).all()).toHaveLength(0);
  });

  it("sums every category into the total", () => {
    createPhysicalAsset({ name: "Flat", category: "property", valueGbp: 1000.1 });
    createPhysicalAsset({ name: "Watch", category: "valuables", valueGbp: 200.2 });
    createPhysicalAsset({ name: "Desk", category: "other", valueGbp: 50 });
    expect(totalPhysicalAssetsGbp()).toBeCloseTo(1250.3);
  });

  it("rejects a missing asset", () => {
    expect(() => updatePhysicalAsset("missing", { name: "Nope" })).toThrow(/not found/);
    expect(() => deletePhysicalAsset("missing")).toThrow(/not found/);
  });
});

describe("physical asset routes", () => {
  it("validates and round-trips through the API", async () => {
    const bad = await POST(
      new Request("http://localhost/api/physical-assets", {
        method: "POST",
        body: JSON.stringify({ name: "", category: "vehicle", valueGbp: -1 }),
      })
    );
    expect(bad.status).toBe(422);

    const created = await POST(
      new Request("http://localhost/api/physical-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Example car",
          category: "vehicle",
          valueGbp: 5000,
          purchaseDate: "2021-01-15",
        }),
      })
    );
    expect(created.status).toBe(201);
    const asset = (await created.json()) as { id: string };

    const listed = await GET();
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { totalGbp: number; assets: unknown[] };
    expect(body.totalGbp).toBe(5000);
    expect(body.assets).toHaveLength(1);

    const patched = await PATCH(
      new Request("http://localhost/api/physical-assets/" + asset.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valueGbp: 4500 }),
      }),
      { params: Promise.resolve({ id: asset.id }) }
    );
    expect(patched.status).toBe(200);

    const removed = await DELETE(new Request("http://localhost/api/physical-assets/" + asset.id), {
      params: Promise.resolve({ id: asset.id }),
    });
    expect(removed.status).toBe(204);
    expect(totalPhysicalAssetsGbp()).toBe(0);
  });
});
