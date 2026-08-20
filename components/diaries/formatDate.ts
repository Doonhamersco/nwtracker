export function formatRecordedDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
