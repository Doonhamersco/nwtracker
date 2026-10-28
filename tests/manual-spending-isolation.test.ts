import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeAllDatabases } from "@/db/client";
import { getManualSpending, saveManualCategoryTotals } from "@/lib/services/manual-spending";
import { runAsUser } from "@/lib/users/context";

const OWNER = "owner@example.com";
const DAD = "dad@example.com";

let tmp = "";
const previous = {
  DATA_DIR: process.env.DATA_DIR,
  DB_PATH: process.env.DB_PATH,
  ALLOWED_EMAIL: process.env.ALLOWED_EMAIL,
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nw-manual-spending-"));
  process.env.DATA_DIR = tmp;
  process.env.DB_PATH = path.join(tmp, "nwtracker.db");
  delete process.env.ALLOWED_EMAIL;
  process.env.ALLOWED_EMAILS = `${OWNER},${DAD}`;
});

afterEach(() => {
  closeAllDatabases();
  fs.rmSync(tmp, { recursive: true, force: true });
  restore("DATA_DIR", previous.DATA_DIR);
  restore("DB_PATH", previous.DB_PATH);
  restore("ALLOWED_EMAIL", previous.ALLOWED_EMAIL);
  restore("ALLOWED_EMAILS", previous.ALLOWED_EMAILS);
});

function restore(name: keyof typeof previous, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("manual spending isolation", () => {
  it("keeps each person's monthly totals in their own database", () => {
    runAsUser(OWNER, () =>
      saveManualCategoryTotals("2026-10", [{ category: "Groceries", amountGbp: 310 }])
    );

    const dadBefore = runAsUser(DAD, () => getManualSpending("2026-10"));
    expect(dadBefore.categories.find((row) => row.category === "Groceries")?.enteredGbp).toBe(0);

    runAsUser(DAD, () =>
      saveManualCategoryTotals("2026-10", [{ category: "Groceries", amountGbp: 99 }])
    );

    const owner = runAsUser(OWNER, () => getManualSpending("2026-10"));
    const dad = runAsUser(DAD, () => getManualSpending("2026-10"));
    expect(owner.categories.find((row) => row.category === "Groceries")?.enteredGbp).toBe(310);
    expect(dad.categories.find((row) => row.category === "Groceries")?.enteredGbp).toBe(99);
  });
});
