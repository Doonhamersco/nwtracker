const INVESTMENT_CATEGORIES = new Set(["ISA", "PENSION", "STOCKS", "CRYPTO"]);

export function isInvestmentCategory(category: string): boolean {
  return INVESTMENT_CATEGORIES.has(category);
}

/** Deposits are stored only for investment accounts, and only when the user typed one. */
export function netDepositForAccount(
  category: string,
  value: number | null | undefined
): number | null {
  if (!isInvestmentCategory(category)) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}
