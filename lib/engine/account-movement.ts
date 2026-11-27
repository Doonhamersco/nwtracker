export interface AccountMovement {
  /** Null when there is no previous balance to compare. */
  amount: number | null;
  percent: number | null;
  /** "growth" once a deposit or withdrawal was recorded for this span. */
  kind: "change" | "growth";
  hint: string | null;
}

/**
 * Balance change, or growth after net deposits.
 * A blank deposit keeps the full balance change. A number, including zero and
 * withdrawals, is money the user put in or took out over the span.
 */
export function accountMovement(
  currentGbp: number,
  previousGbp: number | null,
  netDepositsGbp: Array<number | null | undefined> | null | undefined
): AccountMovement {
  if (previousGbp === null) {
    return { amount: null, percent: null, kind: "change", hint: null };
  }
  const change = currentGbp - previousGbp;
  const recorded = (netDepositsGbp ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const toldUs = netDepositsGbp != null && netDepositsGbp.length > 0 && recorded.length === netDepositsGbp.length;
  if (!toldUs) {
    return {
      amount: change,
      percent: previousGbp !== 0 ? (change / Math.abs(previousGbp)) * 100 : null,
      kind: "change",
      hint: null,
    };
  }
  const deposited = recorded.reduce((sum, value) => sum + value, 0);
  const growth = change - deposited;
  const basis = previousGbp + deposited;
  return {
    amount: growth,
    percent: basis !== 0 ? (growth / Math.abs(basis)) * 100 : null,
    kind: "growth",
    hint: depositHint(deposited),
  };
}

export function depositHint(deposited: number): string {
  const pounds = Math.abs(deposited).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  });
  if (deposited < 0) return `excl. ${pounds} withdrawn`;
  return `excl. ${pounds} deposited`;
}
