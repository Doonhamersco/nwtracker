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
const { previewChaseStatement, saveChaseStatement } = await import("@/lib/services/statement-import");
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

  it("skips opening and closing balance rows and still reads the payments around them", () => {
    const layouts = fs.readFileSync(
      path.join(process.cwd(), "tests/fixtures/chase-statement-layouts.txt"),
      "utf8"
    );
    const statement = parseChaseStatementText(layouts);

    expect(statement.statementMonth).toBe("2026-09");
    expect(statement.openingBalance).toBe(1000);
    expect(statement.closingBalance).toBe(1216.1);
    expect(statement.transactions.map((row) => [row.date, row.description, row.direction, row.amount_gbp, row.balance_gbp, row.type])).toEqual([
      ["2026-09-01", "From EXAMPLE BROKER - SAMPLE CLIENT ACC", "in", 250, 1250, "Faster Payment"],
      ["2026-09-02", "WRAPPED GROCER NAME", "out", 18.4, 1231.6, "Purchase"],
      ["2026-09-03", "CAFE", "out", 4.5, 1227.1, "Purchase"],
      ["2026-09-04", "MARKET STALL", "out", 10, 1217.1, "Purchase"],
      ["2026-09-06", "CORNER SHOP", "out", 1, 1216.1, "Purchase"],
    ]);
    expect(statement.warnings).toEqual([
      {
        date: "2026-09-05",
        description: "MYSTERY MERCHANT",
        message: 'Skipped "MYSTERY MERCHANT" on 2026-09-05: could not read the amount.',
      },
    ]);
  });

  it("keeps a payment together when a page header sits in the middle of it", () => {
    const pageBreak = fs.readFileSync(
      path.join(process.cwd(), "tests/fixtures/chase-statement-page-break.txt"),
      "utf8"
    );
    const preview = previewChaseStatement(pageBreak);
    const { statement } = preview;

    expect(statement.statementMonth).toBe("2026-09");
    expect(statement.openingBalance).toBe(1000);
    expect(statement.closingBalance).toBe(1396.5);
    expect(preview.warnings).toEqual([]);
    expect(statement.transactions.map((row) => [row.date, row.description, row.type, row.direction, row.amount_gbp, row.balance_gbp])).toEqual([
      ["2026-09-05", "CORNER CAFE", "Purchase", "out", 3.5, 996.5],
      ["2026-09-06", "Alex Example / From Alex Example - Sept rent", "Payment", "in", 400, 1396.5],
    ]);
    expect(statement.transactions.some((row) => /page \d+ of \d+|account number|sort code/i.test(row.description))).toBe(false);
    expect(preview.balanceCheck.ok).toBe(true);
    expect(preview.balanceCheck.delta).toBe(0);

    let running = statement.openingBalance ?? 0;
    for (const row of statement.transactions) {
      running = Math.round((running + (row.direction === "out" ? -row.amount_gbp : row.amount_gbp)) * 100) / 100;
      expect(row.balance_gbp).toBe(running);
    }
    expect(running).toBe(statement.closingBalance);
  });

  it("keeps a transaction date that sits on its own line under the column heading", () => {
    const statement = parseChaseStatementText(`
      1 September 2026 to 30 September 2026
      Opening balance £100.00
      Closing balance £90.00
      Page 1 of 2
      Account number: 00001111
      Alex Example's Account statement
      Sort code: 60-00-00
      01 September 2026
      Date Description Amount Balance
      02 September 2026
      CORNER CAFE
      Purchase
      -£10.00 £90.00
    `);

    expect(statement.warnings).toEqual([]);
    expect(statement.transactions).toEqual([
      expect.objectContaining({
        date: "2026-09-02",
        description: "CORNER CAFE",
        type: "Purchase",
        direction: "out",
        amount_gbp: 10,
        balance_gbp: 90,
      }),
    ]);
  });

  it("does not abort the statement when one row has no amount", () => {
    const statement = parseChaseStatementText(`
      1 September 2026 to 30 September 2026
      Opening balance £100.00
      01 Sep 2026 Opening balance
      £100.00
      01 Sep 2026 Opening balance From EXAMPLE BROKER - SAMPLE CLIENT ACC
      01 Sep 2026 GOOD PAYMENT +£10.00 £110.00
      Payment
      02 Sep 2026 BROKEN ROW
      Purchase
      03 Sep 2026 Closing balance £110.00
    `);
    expect(statement.transactions.map((row) => row.description)).toEqual(["GOOD PAYMENT"]);
    expect(statement.openingBalance).toBe(100);
    expect(statement.closingBalance).toBe(110);
    expect(statement.warnings.map((warning) => warning.description)).toEqual([
      "From EXAMPLE BROKER - SAMPLE CLIENT ACC",
      "BROKEN ROW",
    ]);
  });
});

describe("saveChaseStatement", () => {
  it("lists skipped rows on the preview and still saves the readable ones", () => {
    const text = `
      1 September 2026 to 30 September 2026
      Opening balance £40.00
      01 Sep 2026 Opening balance From EXAMPLE BROKER - SAMPLE CLIENT ACC
      +£10.00 £50.00
      Faster Payment
      02 Sep 2026 UNREADABLE MERCHANT
      Purchase
    `;
    const preview = previewChaseStatement(text);
    expect(preview.statement.transactions).toHaveLength(1);
    expect(preview.statement.transactions[0]?.description).toBe("From EXAMPLE BROKER - SAMPLE CLIENT ACC");
    expect(preview.warnings).toHaveLength(1);
    expect(preview.warnings[0]?.message).toContain("UNREADABLE MERCHANT");

    const saved = saveChaseStatement(text);
    expect(saved.inserted).toBe(1);
    expect(saved.skipped).toBe(0);
  });

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
