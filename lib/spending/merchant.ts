/**
 * Turn a bank narrative into a merchant name used for grouping.
 * Prefixes like "To"/"From" and trailing payment references are dropped.
 */
export function cleanMerchant(description: string): string {
  let text = description.trim().replace(/\s+/g, " ");
  if (!text) return description.trim();
  if (/^cash withdrawal\b/i.test(text)) return "Cash withdrawal";
  if (/^round up$/i.test(text)) return "Round up";

  text = text.replace(/^(to|from)\s+/i, "");
  const dashParts = text.split(/\s+-\s+/);
  if (dashParts.length > 1) {
    text = dashParts[0] ?? text;
  }
  text = text.replace(/\s+\d{6,}$/, "").trim();
  return text || description.trim();
}

export function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Savings pots, round-ups, and moves between the user's own accounts
 * are transfers and are excluded from spend and income.
 */
export function inferIsTransfer(input: {
  description: string;
  category: string | null;
  explicit?: boolean | null;
}): boolean {
  if (typeof input.explicit === "boolean") return input.explicit;
  const category = input.category?.toLowerCase() ?? "";
  if (category.includes("savings")) return true;
  const description = input.description.trim();
  if (/^round up$/i.test(description)) return true;
  if (/^(to|from)\s+(high interest|regular saver)\b/i.test(description)) {
    return true;
  }
  return false;
}
