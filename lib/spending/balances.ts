import { roundPence, signedAmount } from "@/lib/spending/money";

export interface BalanceCheck {
  ok: boolean;
  openingBalance: number | null;
  closingBalance: number | null;
  computedClosing: number | null;
  lastBalance: number | null;
  delta: number | null;
}

export function checkStatementBalances(input: {
  openingBalance?: number | null;
  closingBalance?: number | null;
  transactions: Array<{
    amountGbp: number;
    direction: "in" | "out";
    balanceGbp: number;
  }>;
}): BalanceCheck {
  const opening =
    input.openingBalance === undefined || input.openingBalance === null
      ? null
      : roundPence(input.openingBalance);
  const closing =
    input.closingBalance === undefined || input.closingBalance === null
      ? null
      : roundPence(input.closingBalance);
  const last = input.transactions.at(-1);
  const lastBalance = last ? roundPence(last.balanceGbp) : null;

  let computedClosing: number | null = null;
  let rowsMatch = true;
  if (opening !== null) {
    let running = opening;
    for (const tx of input.transactions) {
      running = roundPence(running + signedAmount(tx.amountGbp, tx.direction));
      if (Math.abs(running - roundPence(tx.balanceGbp)) > 0.02) {
        rowsMatch = false;
      }
    }
    computedClosing = running;
  }

  let delta: number | null = null;
  let ok = rowsMatch;
  if (computedClosing !== null && closing !== null) {
    delta = roundPence(computedClosing - closing);
    ok = ok && Math.abs(delta) < 0.02;
  } else if (closing !== null && lastBalance !== null) {
    delta = roundPence(lastBalance - closing);
    ok = ok && Math.abs(delta) < 0.02;
  }

  return {
    ok,
    openingBalance: opening,
    closingBalance: closing,
    computedClosing,
    lastBalance,
    delta,
  };
}
