import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAllTables } from "./helpers/test-db";
import { transactions } from "@/db/schema";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/spending/pdf-text", () => ({
  extractPdfText: vi.fn(),
}));

const { parseChaseStatementText, ChaseStatementParseError } = await import(
  "@/lib/spending/chase-statement"
);
const { saveChaseStatement } = await import("@/lib/services/statement-import");
const { importTransactions } = await import("@/lib/services/transactions");
const { auth } = await import("@/lib/auth");
const { extractPdfText } = await import("@/lib/spending/pdf-text");
const { POST } = await import("@/app/api/spending/statement/route");

const clientModule = await import("@/db/client");
const { db } = clientModule;
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

const fixture = fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/chase-statement.txt"),
  "utf8"
);

beforeEach(() => {
  resetAllTables(sqlite);
  vi.mocked(auth).mockReset();
  vi.mocked(extractPdfText).mockReset();
});

describe("parseChaseStatementText", () => {
  it("reads dates, descriptions, signed amounts, and running balances", () => {
    const statement = parseChaseStatementText(fixture);

    expect(statement.account).toBe("Chase UK");
    expect(statement.statementMonth).toBe("2026-09");
    expect(statement.openingBalance).toBe(1000);
    expect(statement.closingBalance).toBe(1203.5);
    expect(statement.transactions).toEqual([
      {
        date: "2026-09-01",
        description: "NORTHWIND GROCERS",
        type: "Purchase",
        amount_gbp: 18.4,
        direction: "out",
        balance_gbp: 981.6,
      },
      {
        date: "2026-09-02",
        description: "EXAMPLE PAYROLL",
        type: "Payment",
        amount_gbp: 250,
        direction: "in",
        balance_gbp: 1231.6,
      },
      {
        date: "2026-09-03",
        description: "CITY TRANSIT",
        type: "Purchase",
        amount_gbp: 12.1,
        direction: "out",
        balance_gbp: 1219.5,
      },
      {
        date: "2026-09-04",
        description: "HARBOUR CAFE",
        type: "Purchase",
        amount_gbp: 11.9,
        direction: "out",
        balance_gbp: 1207.6,
      },
      {
        date: "2026-09-05",
        description: "Round up",
        type: "Transfer",
        amount_gbp: 0.1,
        direction: "out",
        balance_gbp: 1207.5,
        is_transfer: true,
      },
      {
        date: "2026-09-06",
        description: "RIVER BOOKS",
        type: "Purchase",
        amount_gbp: 4,
        direction: "out",
        balance_gbp: 1203.5,
      },
    ]);
  });

  it("uses the statement period when a line is dated in another month", () => {
    const statement = parseChaseStatementText(`
      1 August 2026 to 31 August 2026
      Opening balance £50.00
      31 Aug 2026 LATE SHOP -£5.00 £45.00
      Purchase
      02 Sep 2026 NEXT MONTH +£10.00 £55.00
      Payment
    `);
    expect(statement.statementMonth).toBe("2026-08");
    expect(statement.transactions.map((row) => row.date)).toEqual(["2026-08-31", "2026-09-02"]);
  });

  it("infers direction from the running balance when amounts are unsigned", () => {
    const statement = parseChaseStatementText(`
      Opening balance £100.00
      Closing balance £95.00
      01 Sep 2026 MARKET STALL £10.00 £90.00
      Purchase
      02 Sep 2026 REFUND SHOP £5.00 £95.00
      Payment
    `);
    expect(statement.transactions.map((row) => [row.description, row.direction, row.amount_gbp])).toEqual([
      ["MARKET STALL", "out", 10],
      ["REFUND SHOP", "in", 5],
    ]);
  });

  it("rejects a document with no transactions", () => {
    expect(() => parseChaseStatementText("Chase UK\nOpening balance £10.00\n")).toThrow(
      ChaseStatementParseError
    );
  });
});

describe("saveChaseStatement", () => {
  it("skips lines that were already imported", () => {
    const first = saveChaseStatement(fixture);
    const second = saveChaseStatement(fixture);
    expect(first.inserted).toBe(6);
    expect(first.skipped).toBe(0);
    expect(first.balanceCheck.ok).toBe(true);
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(6);
    expect(db.select().from(transactions).all()).toHaveLength(6);
  });

  it("uses the same fingerprint as the JSON import", () => {
    const parsed = parseChaseStatementText(fixture);
    importTransactions(parsed);
    const again = saveChaseStatement(fixture);
    expect(again.inserted).toBe(0);
    expect(again.skipped).toBe(parsed.transactions.length);
  });
});

describe("POST /api/spending/statement", () => {
  function pdfRequest(intent: "preview" | "save") {
    const form = new FormData();
    form.set("intent", intent);
    form.set("file", new File([Buffer.from("%PDF-1.4\n%synthetic")], "statement.pdf", { type: "application/pdf" }));
    return new Request("http://localhost/api/spending/statement", { method: "POST", body: form });
  }

  it("requires a signed-in session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await POST(pdfRequest("preview"));
    expect(res.status).toBe(401);
    expect(extractPdfText).not.toHaveBeenCalled();
  });

  it("previews a statement and then saves it for a signed-in user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { email: "alex@example.com" } } as never);
    vi.mocked(extractPdfText).mockResolvedValue(fixture);

    const preview = await POST(pdfRequest("preview"));
    expect(preview.status).toBe(200);
    const body = (await preview.json()) as { statement: { transactions: unknown[] } };
    expect(body.statement.transactions).toHaveLength(6);

    const saved = await POST(pdfRequest("save"));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ inserted: 6, skipped: 0, statementMonth: "2026-09" });
  });
});
