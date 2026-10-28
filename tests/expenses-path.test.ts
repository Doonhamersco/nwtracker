import { describe, expect, it } from "vitest";
import { pagePathContainingSubscriptions } from "@/lib/routes/expenses-path";

describe("pagePathContainingSubscriptions", () => {
  it("sends the old page to /expenses", () => {
    expect(pagePathContainingSubscriptions("/subscriptions")).toBe("/expenses");
    expect(pagePathContainingSubscriptions("/subscriptions/extra")).toBe("/expenses/extra");
    expect(pagePathContainingSubscriptions("/Subscriptions")).toBe("/expenses");
  });

  it("leaves the data API on its current path", () => {
    expect(pagePathContainingSubscriptions("/api/subscriptions")).toBeNull();
    expect(pagePathContainingSubscriptions("/api/subscriptions/abc")).toBeNull();
  });

  it("leaves unrelated pages alone", () => {
    expect(pagePathContainingSubscriptions("/expenses")).toBeNull();
    expect(pagePathContainingSubscriptions("/spending")).toBeNull();
  });
});
