export function gbp(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
