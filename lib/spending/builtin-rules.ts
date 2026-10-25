import { matchCategoryRule, type CategoryRule } from "@/lib/spending/rules";

/**
 * Default merchant rules for statement lines that have no category yet.
 * User-saved rules are applied first and always win. Within this list a
 * lower priority number wins, then the longer pattern, so "Uber Eats" and
 * "Tesco Petrol" beat the broader "Uber" and "Tesco" rules.
 */
const SPECIFIC = 10;
const GENERAL = 20;

function rule(
  pattern: string,
  category: string,
  options?: {
    matchType?: CategoryRule["matchType"];
    priority?: number;
    isTransfer?: boolean;
  }
): CategoryRule {
  return {
    id: `builtin:${pattern}:${category}`,
    pattern,
    matchType: options?.matchType ?? "contains",
    category,
    isTransfer: options?.isTransfer ?? false,
    priority: options?.priority ?? GENERAL,
  };
}

export const BUILTIN_CATEGORY_RULES: CategoryRule[] = [
  rule("uber eats", "Eating out", { priority: SPECIFIC }),
  rule("just eat", "Eating out"),
  rule("deliveroo", "Eating out"),
  rule("kfc", "Eating out"),
  rule("mcdonald", "Eating out"),
  rule("greggs", "Eating out"),
  rule("nandos", "Eating out"),
  rule("nando's", "Eating out"),
  rule("starbucks", "Eating out"),
  rule("costa coffee", "Eating out"),
  rule("\\bcosta\\b", "Eating out", { matchType: "regex" }),
  rule("\\bpret\\b", "Eating out", { matchType: "regex" }),
  rule("burger king", "Eating out"),
  rule("\\bsubway\\b", "Eating out", { matchType: "regex" }),
  rule("domino", "Eating out"),

  rule("tesco petrol", "Transport", { priority: SPECIFIC }),
  rule("petrol", "Transport", { priority: SPECIFIC }),
  rule("filling station", "Transport", { priority: SPECIFIC }),
  rule("\\bshell\\b", "Transport", { matchType: "regex", priority: SPECIFIC }),
  rule("\\besso\\b", "Transport", { matchType: "regex", priority: SPECIFIC }),
  rule("\\bbp\\b", "Transport", { matchType: "regex", priority: SPECIFIC }),

  rule("tesco", "Groceries"),
  rule("asda", "Groceries"),
  rule("\\baldi\\b", "Groceries", { matchType: "regex" }),
  rule("lidl", "Groceries"),
  rule("sainsbury", "Groceries"),
  rule("morrisons", "Groceries"),
  rule("co-op", "Groceries"),
  rule("co op", "Groceries"),
  rule("\\bcoop\\b", "Groceries", { matchType: "regex" }),
  rule("waitrose", "Groceries"),
  rule("iceland", "Groceries"),

  rule("amazon prime", "Subscriptions/entertainment", { priority: SPECIFIC }),
  rule("amazon\\W*prime", "Subscriptions/entertainment", { matchType: "regex", priority: SPECIFIC }),
  rule("prime video", "Subscriptions/entertainment", { priority: SPECIFIC }),
  rule("netflix", "Subscriptions/entertainment"),
  rule("spotify", "Subscriptions/entertainment"),
  rule("disney", "Subscriptions/entertainment"),
  rule("xbox", "Subscriptions/entertainment"),
  rule("game pass", "Subscriptions/entertainment"),
  rule("playstation", "Subscriptions/entertainment"),
  rule("\\bsteam\\b", "Subscriptions/entertainment", { matchType: "regex" }),
  rule("itunes", "Subscriptions/entertainment"),
  rule("apple tv", "Subscriptions/entertainment"),
  rule("nintendo", "Subscriptions/entertainment"),
  rule("audible", "Subscriptions/entertainment"),

  rule("\\buber\\b", "Transport", { matchType: "regex" }),
  rule("mipermit", "Transport"),
  rule("ring\\s*go", "Transport", { matchType: "regex" }),
  rule("scotrail", "Transport"),
  rule("stagecoach", "Transport"),
  rule("trainline", "Transport"),
  rule("\\btfl\\b", "Transport", { matchType: "regex" }),
  rule("national express", "Transport"),

  rule("amazon", "Shopping"),
  rule("\\bamzn\\b", "Shopping", { matchType: "regex" }),

  rule("round up", "Savings (round-ups)", { priority: SPECIFIC, isTransfer: true }),
  rule("round-up", "Savings (round-ups)", { priority: SPECIFIC, isTransfer: true }),
  rule("roundup", "Savings (round-ups)", { priority: SPECIFIC, isTransfer: true }),
];

export function matchBuiltinCategory(
  description: string,
  merchant: string
): CategoryRule | null {
  return matchCategoryRule(BUILTIN_CATEGORY_RULES, description, merchant);
}
