import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { matchBuiltinCategory } from "@/lib/spending/builtin-rules";
import { TransactionsTable } from "@/components/spending/TransactionsTable";
import type { SpendingTransaction } from "@/lib/spending/types";

function categoryFor(description: string): string | null {
  const merchant = description;
  return matchBuiltinCategory(description, merchant)?.category ?? null;
}

describe("matchBuiltinCategory", () => {
  it("maps common UK food merchants to Eating out", () => {
    expect(categoryFor("KFC DUMFRIES")).toBe("Eating out");
    expect(categoryFor("McDonald's")).toBe("Eating out");
    expect(categoryFor("MCDONALDS")).toBe("Eating out");
    expect(categoryFor("Greggs")).toBe("Eating out");
    expect(categoryFor("DELIVEROO")).toBe("Eating out");
    expect(categoryFor("Just Eat")).toBe("Eating out");
    expect(categoryFor("UBER EATS")).toBe("Eating out");
  });

  it("maps supermarkets to Groceries and petrol stations to Transport", () => {
    for (const name of ["Tesco", "ASDA", "aldi stores", "Lidl", "Sainsbury's", "Morrisons", "Co-op"]) {
      expect(categoryFor(name)).toBe("Groceries");
    }
    expect(categoryFor("Tesco Petrol Filling Station")).toBe("Transport");
    expect(categoryFor("SHELL")).toBe("Transport");
    expect(categoryFor("BP CONNECT")).toBe("Transport");
    expect(categoryFor("Esso")).toBe("Transport");
    expect(categoryFor("GBP")).toBeNull();
  });

  it("maps streaming and games to Subscriptions/entertainment, and Amazon shopping separately", () => {
    for (const name of ["XBOX", "PlayStation", "Steam", "Netflix", "Spotify", "Disney+"]) {
      expect(categoryFor(name)).toBe("Subscriptions/entertainment");
    }
    expect(categoryFor("Amazon Prime")).toBe("Subscriptions/entertainment");
    expect(categoryFor("AMAZON*PRIME")).toBe("Subscriptions/entertainment");
    expect(categoryFor("Amazon Marketplace")).toBe("Shopping");
  });

  it("maps parking, ride-hailing, and rail to Transport", () => {
    expect(categoryFor("MiPermit")).toBe("Transport");
    expect(categoryFor("RingGo")).toBe("Transport");
    expect(categoryFor("UBER TRIP")).toBe("Transport");
    expect(categoryFor("ScotRail")).toBe("Transport");
    expect(categoryFor("Stagecoach")).toBe("Transport");
  });

  it("maps round ups to savings and leaves unknown merchants alone", () => {
    const roundUp = matchBuiltinCategory("Round up", "Round up");
    expect(roundUp?.category).toBe("Savings (round-ups)");
    expect(roundUp?.isTransfer).toBe(true);
    expect(categoryFor("Queen of the South Foo")).toBeNull();
  });
});

describe("TransactionsTable auto hint", () => {
  it("marks a built-in category and hides the hint after a manual choice", () => {
    const base: SpendingTransaction = {
      id: "tx-1",
      accountId: "acct",
      date: "2026-09-05",
      descriptionRaw: "KFC",
      merchant: "KFC",
      amountGbp: -1.99,
      direction: "out",
      type: "Purchase",
      balanceAfterGbp: 10,
      category: "Eating out",
      categorySource: "builtin",
      isTransfer: false,
      subscriptionId: null,
      statementMonth: "2026-09",
      notes: null,
      createdAt: "2026-09-05 00:00:00",
    };

    const autoHtml = renderToStaticMarkup(
      createElement(TransactionsTable, {
        transactions: [base],
        categories: ["Eating out", "Groceries"],
        onChanged() {},
      })
    );
    expect(autoHtml).toContain(">auto<");
    expect(autoHtml).toContain("Eating out");

    const manualHtml = renderToStaticMarkup(
      createElement(TransactionsTable, {
        transactions: [{ ...base, category: "Takeaway", categorySource: "manual" }],
        categories: ["Eating out", "Takeaway"],
        onChanged() {},
      })
    );
    expect(manualHtml).not.toContain(">auto<");
  });
});
