/** Calendar helpers pinned to Europe/London so training weeks match the owner. */

export const TRAINING_TIME_ZONE = "Europe/London";

/** College of Policing style test: bleep test and a 1.5-mile run. */
export const FITNESS_TEST_DATE = "2026-11-24";
export const FITNESS_TEST_LABEL = "Bleep test and 1.5-mile run";

/** Runs in a rolling week that count as on track for the test. */
export const CARDIO_RUNS_PER_WEEK = 3;

export function londonToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TRAINING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday of the ISO week containing `isoDate`, as YYYY-MM-DD. */
export function weekStart(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1;
  return addDays(isoDate, -daysFromMonday);
}

/** Whole London calendar days from `todayISO` until `targetISO`. Negative once the date has passed. */
export function daysUntil(todayISO: string, targetISO: string): number {
  const start = Date.parse(`${todayISO}T00:00:00Z`);
  const end = Date.parse(`${targetISO}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}
