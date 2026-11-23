/** Display helpers for snapshot `taken_at`. SQLite `datetime('now')` is UTC with no zone. */

export const CHECKIN_TIME_ZONE = "Europe/London";

export interface CheckinStamp {
  takenAt: string;
  isPartial: boolean;
}

/**
 * Parse a snapshot timestamp as an absolute instant.
 * Zoneless values (the SQLite default) are UTC. An existing Z or numeric offset is kept.
 */
export function parseUtcTakenAt(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalised = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(normalised);
  const ms = Date.parse(hasZone ? normalised : `${normalised}Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

/** Most recent check-in by absolute time. Partial rows compete with full ones. */
export function pickLatestCheckin(rows: CheckinStamp[]): CheckinStamp | null {
  let best: CheckinStamp | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const instant = parseUtcTakenAt(row.takenAt);
    if (!instant) continue;
    const ms = instant.getTime();
    if (ms <= bestMs) continue;
    best = { takenAt: row.takenAt, isPartial: row.isPartial };
    bestMs = ms;
  }
  return best;
}

/** `28 Nov 2026, 19:42` in Europe/London. */
export function formatLondonCheckin(takenAt: string): string | null {
  const instant = parseUtcTakenAt(takenAt);
  if (!instant) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CHECKIN_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const day = value("day");
  const month = value("month");
  const year = value("year");
  const hour = value("hour");
  const minute = value("minute");
  if (!day || !month || !year || !hour || !minute) return null;
  return `${day} ${month} ${year}, ${hour}:${minute}`;
}

/** Dashboard line. Null when there is no usable timestamp. */
export function formatLastCheckinLine(checkin: CheckinStamp | null): string | null {
  if (!checkin) return null;
  const when = formatLondonCheckin(checkin.takenAt);
  if (!when) return null;
  const note = checkin.isPartial ? "UK time, partial" : "UK time";
  return `Last check-in: ${when} (${note})`;
}
