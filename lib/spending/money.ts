export function roundPence(value: number): number {
  return Math.round(value * 100) / 100;
}

export function signedAmount(
  amountGbp: number,
  direction: "in" | "out"
): number {
  const absolute = roundPence(Math.abs(amountGbp));
  return direction === "out" ? -absolute : absolute;
}

export function formatGbp(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPct(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}
