import type { CategoryRuleMatchType } from "@/db/schema";

export interface CategoryRule {
  id: string;
  pattern: string;
  matchType: CategoryRuleMatchType;
  category: string;
  isTransfer: boolean;
  priority: number;
}

function matches(rule: CategoryRule, description: string, merchant: string): boolean {
  const haystacks = [description, merchant];
  if (rule.matchType === "exact") {
    const pattern = rule.pattern.toLowerCase();
    return haystacks.some((value) => value.toLowerCase() === pattern);
  }
  if (rule.matchType === "contains") {
    const pattern = rule.pattern.toLowerCase();
    return haystacks.some((value) => value.toLowerCase().includes(pattern));
  }
  try {
    const expression = new RegExp(rule.pattern, "i");
    return haystacks.some((value) => expression.test(value));
  } catch {
    return false;
  }
}

/** Lowest priority number wins. Equal priority prefers the longer pattern. */
export function matchCategoryRule(
  rules: CategoryRule[],
  description: string,
  merchant: string
): CategoryRule | null {
  const hits = rules.filter((rule) => matches(rule, description, merchant));
  hits.sort(
    (a, b) => a.priority - b.priority || b.pattern.length - a.pattern.length
  );
  return hits[0] ?? null;
}
