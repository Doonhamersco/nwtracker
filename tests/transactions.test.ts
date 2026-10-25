import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { resetAllTables } from "./helpers/test-db";
import { bearerMatches } from "@/lib/auth/bearer";
import { transactionFingerprint } from "@/lib/spending/hash";
import { cleanMerchant } from "@/lib/spending/merchant";
import { matchCategoryRule } from "@/lib/spending/rules";
import { accounts, transactionCategoryRules, transactions } from "@/db/schema";

vi.mock("@/db/client", async () => {
  const { createTestDb } = await import("./helpers/test-db");
  const { db, sqlite } = createTestDb();
  return { db, _sqlite: sqlite };
});

const clientModule = await import("@/db/client");
const { db } = clientModule;
const sqlite = (clientModule as unknown as { _sqlite: import("better-sqlite3").Database })._sqlite;

const { importTransactions, updateTransaction, createCategoryRule } = await import(
  "@/lib/services/transactions"
);
const { getSpendingReport, addRecurringSubscription } = await import(
  "@/lib/services/spending"
);
const { POST } = await import("@/app/api/import/transactions/route");

beforeEach(() => {
  resetAllTables(sqlite);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.length > 0));
}

function fixturePayload() {
  const text = fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/transactions-2026-09.csv"),
    "utf8"
  );
  const [header, ...lines] = parseCsv(text);
  expect(header).toEqual([
    "date",
    "description",
    "type",
    "amount_gbp",
    "direction",
    "balance_gbp",
    "category",
  ]);
  return {
    account: "Chase UK",
    statementMonth: "2026-09",
    openingBalance: 230.76,
    closingBalance: 507.11,
    transactions: lines.map((line) => ({
      date: line[0],
      description: line[1],
      type: line[2],
      amount_gbp: Number(line[3]),
      direction: line[4] as "in" | "out",
      balance_gbp: Number(line[5]),
      category: line[6],
    })),
  };
}

describe("transactionFingerprint", () => {
  it("hashes the canonical statement line", () => {
    expect(
      transactionFingerprint({
        accountId: "acct",
        date: "2026-09-02",
        amount: 12.12,
        direction: "out",
        descriptionRaw: "ALDI",
        balanceAfter: 362.76,
      })
    ).toBe("b419b06a9c82647bbb33ababb53ed7cd2717b017c0d8e01a048b942ceaa6d0dc");
  });

  it("rounds amounts to pence and changes when any hashed field changes", () => {
    const base = {
      accountId: "acct",
      date: "2026-09-02",
      amount: 12.1,
      direction: "out" as const,
      descriptionRaw: "ALDI",
      balanceAfter: 362.76,
    };
    const canonical = transactionFingerprint(base);
    expect(transactionFingerprint({ ...base, amount: 12.104 })).toBe(canonical);
    expect(transactionFingerprint({ ...base, amount: 12.11 })).not.toBe(canonical);
    expect(transactionFingerprint({ ...base, descriptionRaw: "Aldi" })).not.toBe(canonical);
    expect(transactionFingerprint({ ...base, direction: "in" })).not.toBe(canonical);
    expect(transactionFingerprint({ ...base, balanceAfter: 362.77 })).not.toBe(canonical);
    expect(transactionFingerprint({ ...base, date: "2026-09-03" })).not.toBe(canonical);
    expect(transactionFingerprint({ ...base, accountId: "other" })).not.toBe(canonical);
  });
});

describe("cleanMerchant", () => {
  it("strips payment prefixes and reference tails", () => {
    expect(cleanMerchant("ALDI")).toBe("ALDI");
    expect(cleanMerchant("Round up")).toBe("Round up");
    expect(cleanMerchant("To High Interest")).toBe("High Interest");
    expect(cleanMerchant("From PAYPAL - PPWDL574222252GG38")).toBe("PAYPAL");
    expect(cleanMerchant("To Oliver Hilton-Limb - bills")).toBe("Oliver Hilton-Limb");
    expect(cleanMerchant("Cash withdrawal, 84-86 High St Dumfries, DUMFRIES, DG1 2BJ")).toBe(
      "Cash withdrawal"
    );
  });
});

describe("matchCategoryRule", () => {
  const aldi = {
    id: "1",
    pattern: "ALDI",
    matchType: "contains" as const,
    category: "Groceries",
    isTransfer: false,
    priority: 10,
  };
  const exact = {
    id: "2",
    pattern: "ALDI",
    matchType: "exact" as const,
    category: "Supermarket",
    isTransfer: false,
    priority: 1,
  };

  it("prefers the lower priority number", () => {
    expect(matchCategoryRule([aldi, exact], "ALDI STORES", "ALDI STORES")?.category).toBe(
      "Groceries"
    );
    expect(matchCategoryRule([aldi, exact], "ALDI", "ALDI")?.category).toBe(
      "Supermarket"
    );
  });

  it("ignores an invalid regular expression", () => {
    expect(
      matchCategoryRule(
        [
          {
            id: "3",
            pattern: "(",
            matchType: "regex",
            category: "Broken",
            isTransfer: false,
            priority: 1,
          },
        ],
        "ALDI",
        "ALDI"
      )
    ).toBeNull();
  });
});

describe("import auth", () => {
  it("compares bearer tokens without throwing on different lengths", () => {
    expect(bearerMatches(null, undefined)).toBe(false);
    expect(bearerMatches("Bearer secret", undefined)).toBe(false);
    expect(bearerMatches("Bearer secret", "secret")).toBe(true);
    expect(bearerMatches("bearer secret", "secret")).toBe(true);
    expect(bearerMatches("Bearer no", "secret")).toBe(false);
    expect(bearerMatches("Bearer secret-extra", "secret")).toBe(false);
    expect(bearerMatches("Basic secret", "secret")).toBe(false);
  });

  async function post(body: unknown, authorization?: string) {
    return POST(
      new Request("http://localhost/api/import/transactions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify(body),
      })
    );
  }

  const sample = {
    account: "Chase UK",
    statementMonth: "2026-09",
    transactions: [
      {
        date: "2026-09-02",
        description: "ALDI",
        type: "Purchase",
        amount_gbp: 12.12,
        direction: "out",
        balance_gbp: 362.76,
        category: "Groceries",
      },
    ],
  };

  it("returns 401 when the import token is unset or wrong", async () => {
    vi.stubEnv("IMPORT_API_TOKEN", "");
    expect((await post(sample, "Bearer anything")).status).toBe(401);

    vi.stubEnv("IMPORT_API_TOKEN", "correct-token");
    expect((await post(sample)).status).toBe(401);
    expect((await post(sample, "Bearer wrong")).status).toBe(401);
  });

  it("imports when the bearer matches", async () => {
    vi.stubEnv("IMPORT_API_TOKEN", "correct-token");
    vi.stubEnv("ALLOWED_EMAIL", "owner@example.com");
    const res = await post(sample, "Bearer correct-token");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { inserted: number; skipped: number };
    expect(body.inserted).toBe(1);
    expect(body.skipped).toBe(0);
  });

  it("rejects a bearer import for someone who is not invited", async () => {
    vi.stubEnv("IMPORT_API_TOKEN", "correct-token");
    vi.stubEnv("ALLOWED_EMAIL", "owner@example.com");
    const res = await post({ ...sample, userEmail: "stranger@example.com" }, "Bearer correct-token");
    expect(res.status).toBe(403);
  });
});

describe("importTransactions", () => {
  it("creates Chase UK, applies rules, and skips a second import", () => {
    createCategoryRule({
      pattern: "ALDI",
      matchType: "contains",
      category: "Food shopping",
      isTransfer: false,
      priority: 1,
    });

    const first = importTransactions({
      account: "Chase UK",
      statementMonth: "2026-09",
      openingBalance: 100,
      closingBalance: 87.88,
      transactions: [
        {
          date: "2026-09-02",
          description: "ALDI",
          type: "Purchase",
          amount_gbp: 12.12,
          direction: "out",
          balance_gbp: 87.88,
          category: "Groceries",
        },
      ],
    });

    expect(first.inserted).toBe(1);
    expect(first.skipped).toBe(0);
    expect(first.balanceCheck.ok).toBe(true);

    const [account] = db.select().from(accounts).all();
    expect(account.name).toBe("Chase UK");
    expect(account.institution).toBe("Chase UK");
    expect(account.category).toBe("CASH");
    expect(account.type).toBe("ASSET");

    const [row] = db.select().from(transactions).all();
    expect(row.category).toBe("Food shopping");
    expect(row.categorySource).toBe("rule");
    expect(row.merchant).toBe("ALDI");
    expect(row.amountGbp).toBe(-12.12);
    expect(row.isTransfer).toBe(false);
    expect(row.statementMonth).toBe("2026-09");

    const second = importTransactions({
      account: account.id,
      statementMonth: "2026-09",
      transactions: [
        {
          date: "2026-09-02",
          description: "ALDI",
          type: "Purchase",
          amount_gbp: 12.12,
          direction: "out",
          balance_gbp: 87.88,
          category: "Something else",
        },
      ],
    });
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(1);
    expect(db.select().from(transactions).all()).toHaveLength(1);
    expect(db.select().from(accounts).all()).toHaveLength(1);
  });

  it("keeps a manual category when the same line is imported again", () => {
    importTransactions({
      account: "Chase UK",
      statementMonth: "2026-09",
      transactions: [
        {
          date: "2026-09-05",
          description: "Amazon",
          type: "Purchase",
          amount_gbp: 10,
          direction: "out",
          balance_gbp: 90,
          category: "Shopping",
        },
      ],
    });
    const imported = db.select().from(transactions).all()[0];
    updateTransaction(imported.id, {
      category: "Gifts",
      applyToFuture: true,
    });

    importTransactions({
      account: "Chase UK",
      statementMonth: "2026-09",
      transactions: [
        {
          date: "2026-09-05",
          description: "Amazon",
          type: "Purchase",
          amount_gbp: 10,
          direction: "out",
          balance_gbp: 90,
          category: "Shopping",
        },
        {
          date: "2026-10-05",
          description: "Amazon Marketplace",
          type: "Purchase",
          amount_gbp: 8,
          direction: "out",
          balance_gbp: 82,
        },
      ],
    });

    const rows = db.select().from(transactions).all();
    const original = rows.find((row) => row.date === "2026-09-05");
    const future = rows.find((row) => row.date === "2026-10-05");
    expect(original?.category).toBe("Gifts");
    expect(original?.categorySource).toBe("manual");
    expect(future?.category).toBe("Gifts");
    expect(future?.categorySource).toBe("rule");
    expect(future?.statementMonth).toBe("2026-09");
    const rules = db.select().from(transactionCategoryRules).all();
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe("Amazon");
    expect(rules[0].matchType).toBe("contains");
  });

  it("uses built-in merchants for uncategorised lines and keeps a user rule in front", () => {
    createCategoryRule({
      pattern: "KFC",
      matchType: "contains",
      category: "Takeaway",
      isTransfer: false,
      priority: 500,
    });

    importTransactions({
      account: "Chase UK",
      statementMonth: "2026-09",
      openingBalance: 100,
      closingBalance: 70,
      transactions: [
        {
          date: "2026-09-01",
          description: "KFC DUMFRIES",
          type: "Purchase",
          amount_gbp: 5,
          direction: "out",
          balance_gbp: 95,
        },
        {
          date: "2026-09-02",
          description: "TESCO STORES",
          type: "Purchase",
          amount_gbp: 10,
          direction: "out",
          balance_gbp: 85,
        },
        {
          date: "2026-09-03",
          description: "Amazon",
          type: "Purchase",
          amount_gbp: 10,
          direction: "out",
          balance_gbp: 75,
          category: "Gifts",
        },
        {
          date: "2026-09-04",
          description: "Round up",
          type: "Transfer",
          amount_gbp: 0.5,
          direction: "out",
          balance_gbp: 74.5,
        },
        {
          date: "2026-09-05",
          description: "Corner cafe",
          type: "Purchase",
          amount_gbp: 4.5,
          direction: "out",
          balance_gbp: 70,
        },
      ],
    });

    const rows = db.select().from(transactions).all();
    const byDescription = Object.fromEntries(rows.map((row) => [row.descriptionRaw, row]));
    expect(byDescription["KFC DUMFRIES"]?.category).toBe("Takeaway");
    expect(byDescription["KFC DUMFRIES"]?.categorySource).toBe("rule");
    expect(byDescription["TESCO STORES"]?.category).toBe("Groceries");
    expect(byDescription["TESCO STORES"]?.categorySource).toBe("builtin");
    expect(byDescription.Amazon?.category).toBe("Gifts");
    expect(byDescription.Amazon?.categorySource).toBe("import");
    expect(byDescription["Round up"]?.category).toBe("Savings (round-ups)");
    expect(byDescription["Round up"]?.categorySource).toBe("builtin");
    expect(byDescription["Round up"]?.isTransfer).toBe(true);
    expect(byDescription["Corner cafe"]?.category).toBeNull();
    expect(byDescription["Corner cafe"]?.categorySource).toBeNull();
  });

  it("marks savings pots and round-ups as transfers", () => {
    importTransactions({
      account: "Chase UK",
      statementMonth: "2026-09",
      transactions: [
        {
          date: "2026-09-01",
          description: "Round up",
          type: "Transfer",
          amount_gbp: 0.88,
          direction: "out",
          balance_gbp: 10,
          category: "Savings (round-ups)",
        },
        {
          date: "2026-09-02",
          description: "To High Interest",
          type: "Transfer",
          amount_gbp: 200,
          direction: "out",
          balance_gbp: 20,
          category: "Savings transfers",
        },
      ],
    });
    const rows = db.select().from(transactions).all();
    expect(rows.every((row) => row.isTransfer)).toBe(true);
  });
});

describe("spending aggregates", () => {
  it("summarises the September fixture, excluding transfers", () => {
    const result = importTransactions(fixturePayload());
    expect(result.inserted).toBe(108);
    expect(result.skipped).toBe(0);
    expect(result.balanceCheck.ok).toBe(true);
    expect(result.balanceCheck.computedClosing).toBe(507.11);

    const report = getSpendingReport("2026-09");
    expect(report.totals.spend).toBe(1240.28);
    expect(report.totals.income).toBe(778.84);
    expect(report.totals.savings).toBe(-461.44);
    expect(report.totals.savingsRate).toBeCloseTo(-461.44 / 778.84, 6);

    const groceries = report.byCategory.find((row) => row.category === "Groceries");
    expect(groceries?.spend).toBe(150.14);
    const roundUps = report.byCategory.find((row) => row.category.includes("round"));
    expect(roundUps).toBeUndefined();

    expect(report.topMerchants[0]?.merchant).toBe("Jamal Property World Ltd");
    expect(report.transactions).toHaveLength(108);
    expect(report.transactions.some((tx) => tx.isTransfer && tx.merchant === "Round up")).toBe(
      true
    );

    const apple = report.recurring.find((item) => item.merchant === "Apple / iTunes");
    expect(apple?.amountGbp).toBe(2.99);
    expect(apple?.reason).toBe("matching_amount");
    expect(report.recurring.some((item) => item.merchant === "ALDI")).toBe(false);
  });

  it("detects a monthly merchant and a duplicate subscription", () => {
    importTransactions({
      account: "Chase UK",
      statementMonth: "2026-09",
      transactions: [
        {
          date: "2026-09-05",
          description: "Netflix.com",
          type: "Purchase",
          amount_gbp: 15.99,
          direction: "out",
          balance_gbp: 50,
          category: "Subscriptions/entertainment",
        },
      ],
    });
    importTransactions({
      account: "Chase UK",
      statementMonth: "2026-10",
      transactions: [
        {
          date: "2026-10-05",
          description: "Netflix.com",
          type: "Purchase",
          amount_gbp: 15.99,
          direction: "out",
          balance_gbp: 40,
          category: "Subscriptions/entertainment",
        },
      ],
    });

    const before = getSpendingReport("2026-10");
    expect(before.trend.map((point) => point.month)).toEqual(["2026-09", "2026-10"]);
    expect(before.trend.every((point) => point.spend === 15.99)).toBe(true);
    const netflix = before.recurring.find((item) => item.merchant === "Netflix.com");
    expect(netflix?.reason).toBe("monthly");

    const subscription = addRecurringSubscription({
      merchant: "Netflix.com",
      costGbp: 15.99,
      spendingCategory: "Subscriptions/entertainment",
    });
    expect(subscription.category).toBe("entertainment");
    expect(subscription.billingCycle).toBe("monthly");

    const linked = db
      .select()
      .from(transactions)
      .where(eq(transactions.subscriptionId, subscription.id))
      .all();
    expect(linked).toHaveLength(2);

    const after = getSpendingReport("2026-10");
    expect(after.recurring.some((item) => item.merchant === "Netflix.com")).toBe(false);

    addRecurringSubscription({
      merchant: "Netflix Premium",
      costGbp: 15.99,
      spendingCategory: "Subscriptions/entertainment",
    });
    const duplicates = getSpendingReport("2026-10").duplicateSubscriptions;
    expect(
      duplicates.some((pair) => pair.names.includes("Netflix.com") && pair.names.includes("Netflix Premium"))
    ).toBe(true);
  });

  it("flags a matching amount that is not the same subscription name", () => {
    importTransactions({
      account: "Chase UK",
      statementMonth: "2026-09",
      transactions: [
        {
          date: "2026-09-11",
          description: "Lebara",
          type: "Purchase",
          amount_gbp: 6.9,
          direction: "out",
          balance_gbp: 10,
          category: "Bills",
        },
        {
          date: "2026-09-21",
          description: "Lebara",
          type: "Purchase",
          amount_gbp: 6.9,
          direction: "out",
          balance_gbp: 3,
          category: "Bills",
        },
      ],
    });
    addRecurringSubscription({
      merchant: "Phone plan",
      costGbp: 6.9,
      spendingCategory: "Bills",
    });
    const report = getSpendingReport("2026-09");
    const lebara = report.recurring.find((item) => item.merchant === "Lebara");
    expect(lebara?.possibleDuplicate?.name).toBe("Phone plan");
  });
});
