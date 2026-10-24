import { monthlyEquivalent } from "@/lib/subscriptions-math";
import type { SubscriptionBillingCycle, SubscriptionStatus } from "@/db/schema";
import type { SubscriptionCategory } from "@/db/schema";
import { merchantKey } from "@/lib/spending/merchant";
import { roundPence } from "@/lib/spending/money";
import type {
  DuplicateSubscription,
  RecurringCandidate,
  SpendingTransaction,
} from "@/lib/spending/types";

const VARIABLE_RETAIL =
  /groceries|eating out|leisure|cash|shopping|gambling|transport/i;

export interface SubscriptionRef {
  id: string;
  name: string;
  costGbp: number;
  billingCycle: SubscriptionBillingCycle;
  status: SubscriptionStatus;
}

export function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function namesRelated(a: string, b: string): boolean {
  const left = normaliseName(a);
  const right = normaliseName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = shorter === left ? right : left;
  if (shorter.length >= 4 && longer.includes(shorter)) return true;
  const rightWords = new Set(right.split(" ").filter((word) => word.length >= 4));
  return left
    .split(" ")
    .some((word) => word.length >= 4 && rightWords.has(word));
}

export function subscriptionCategoryFor(
  spendingCategory: string | null
): SubscriptionCategory {
  const category = (spendingCategory ?? "").toLowerCase();
  if (category.includes("entertain") || category.includes("subscription")) {
    return "entertainment";
  }
  if (category.includes("software") || category.includes("game")) return "software";
  if (category.includes("fitness") || category.includes("gym")) return "fitness";
  if (
    category.includes("food") ||
    category.includes("groc") ||
    category.includes("eat")
  ) {
    return "food";
  }
  if (
    category.includes("bill") ||
    category.includes("util") ||
    category.includes("rent") ||
    category.includes("transport")
  ) {
    return "utilities";
  }
  if (category.includes("shop")) return "shopping";
  return "other";
}

function isVariableRetail(category: string | null): boolean {
  return VARIABLE_RETAIL.test(category ?? "");
}

function modalAmount(amounts: number[]): { amount: number; count: number } {
  const counts = new Map<number, number>();
  for (const amount of amounts) {
    const rounded = roundPence(Math.abs(amount));
    counts.set(rounded, (counts.get(rounded) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [amount, count] of counts) {
    if (count > bestCount) {
      best = amount;
      bestCount = count;
    }
  }
  return { amount: best, count: bestCount };
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}

function isRoughlyMonthly(dates: string[]): boolean {
  const unique = [...new Set(dates)].sort();
  if (unique.length < 2) return false;
  const months = new Set(unique.map((date) => date.slice(0, 7)));
  if (months.size < 2) return false;
  const times = unique.map((date) => Date.parse(`${date}T00:00:00Z`));
  for (let i = 1; i < times.length; i++) {
    const days = (times[i] - times[i - 1]) / 86_400_000;
    if (days >= 20 && days <= 40) return true;
  }
  return false;
}

export function detectRecurring(
  transactions: SpendingTransaction[],
  subscriptions: SubscriptionRef[]
): RecurringCandidate[] {
  const active = subscriptions.filter((sub) => sub.status === "active");
  const groups = new Map<string, SpendingTransaction[]>();
  for (const tx of transactions) {
    if (tx.isTransfer || tx.direction !== "out" || tx.subscriptionId) continue;
    const key = merchantKey(tx.merchant);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const found: RecurringCandidate[] = [];
  for (const group of groups.values()) {
    const merchant = mostCommon(group.map((tx) => tx.merchant));
    if (active.some((sub) => namesRelated(sub.name, merchant))) continue;

    const amounts = group.map((tx) => Math.abs(tx.amountGbp));
    const modal = modalAmount(amounts);
    const dates = group.map((tx) => tx.date);
    const monthly = isRoughlyMonthly(dates);
    const stable =
      modal.count >= 2 && (modal.count >= Math.ceil(group.length / 2) || monthly);
    const retail = isVariableRetail(mostCommonCategory(group));
    const matchingAmount = modal.count >= 2 && !retail;

    let reason: RecurringCandidate["reason"] | null = null;
    if (monthly && (stable || !retail)) reason = "monthly";
    else if (matchingAmount) reason = "matching_amount";
    if (!reason) continue;

    const spendingCategory = mostCommonCategory(group);
    const duplicate = active.find(
      (sub) =>
        !namesRelated(sub.name, merchant) &&
        Math.abs(monthlyEquivalent(sub.costGbp, sub.billingCycle) - modal.amount) <
          0.02
    );

    found.push({
      merchant,
      amountGbp: modal.amount,
      count: group.length,
      months: [...new Set(group.map((tx) => tx.statementMonth))].sort(),
      reason,
      spendingCategory,
      possibleDuplicate: duplicate
        ? { id: duplicate.id, name: duplicate.name, costGbp: duplicate.costGbp }
        : null,
    });
  }

  found.sort(
    (a, b) => b.amountGbp - a.amountGbp || a.merchant.localeCompare(b.merchant)
  );
  return found;
}

function mostCommonCategory(group: SpendingTransaction[]): string | null {
  const categories = group
    .map((tx) => tx.category)
    .filter((category): category is string => Boolean(category));
  if (categories.length === 0) return null;
  return mostCommon(categories);
}

export function findDuplicateSubscriptions(
  subscriptions: SubscriptionRef[]
): DuplicateSubscription[] {
  const active = subscriptions.filter((sub) => sub.status === "active");
  const pairs: DuplicateSubscription[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (namesRelated(a.name, b.name)) {
        pairs.push({
          ids: [a.id, b.id],
          names: [a.name, b.name],
          reason: "Similar names",
        });
      }
    }
  }
  return pairs;
}
