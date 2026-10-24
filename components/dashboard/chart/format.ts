export function formatAxisGbp(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(0)}k`;
  return `${sign}£${abs.toFixed(0)}`;
}

export function formatFullGbp(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSignedGbp(value: number): string {
  const formatted = formatFullGbp(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}
