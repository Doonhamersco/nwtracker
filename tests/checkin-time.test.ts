import { describe, expect, it } from "vitest";
import {
  formatLastCheckinLine,
  formatLondonCheckin,
  parseUtcTakenAt,
  pickLatestCheckin,
} from "@/lib/checkin-time";

describe("parseUtcTakenAt", () => {
  it("treats a zoneless SQLite datetime as UTC", () => {
    expect(parseUtcTakenAt("2026-11-28 19:42:00")?.toISOString()).toBe(
      "2026-11-28T19:42:00.000Z"
    );
  });

  it("keeps an explicit offset", () => {
    expect(parseUtcTakenAt("2026-07-01T19:42:00+01:00")?.toISOString()).toBe(
      "2026-07-01T18:42:00.000Z"
    );
  });

  it("rejects blank and unparseable values", () => {
    expect(parseUtcTakenAt("  ")).toBeNull();
    expect(parseUtcTakenAt("not-a-date")).toBeNull();
  });
});

describe("formatLondonCheckin", () => {
  it("prints a winter timestamp in GMT", () => {
    expect(formatLondonCheckin("2026-11-28 19:42:00")).toBe("28 Nov 2026, 19:42");
  });

  it("shifts a summer timestamp forward by one hour for BST", () => {
    expect(formatLondonCheckin("2026-07-01 18:42:00")).toBe("1 Jul 2026, 19:42");
  });

  it("follows the Europe/London spring-forward gap", () => {
    expect(formatLondonCheckin("2026-03-29 00:30:00")).toBe("29 Mar 2026, 00:30");
    expect(formatLondonCheckin("2026-03-29 01:30:00")).toBe("29 Mar 2026, 02:30");
  });
});

describe("formatLastCheckinLine", () => {
  it("matches the dashboard wording", () => {
    expect(
      formatLastCheckinLine({ takenAt: "2026-11-28 19:42:00", isPartial: false })
    ).toBe("Last check-in: 28 Nov 2026, 19:42 (UK time)");
  });

  it("marks a partial snapshot", () => {
    expect(
      formatLastCheckinLine({ takenAt: "2026-11-28 19:42:00", isPartial: true })
    ).toBe("Last check-in: 28 Nov 2026, 19:42 (UK time, partial)");
  });

  it("stays quiet when there is no check-in", () => {
    expect(formatLastCheckinLine(null)).toBeNull();
    expect(formatLastCheckinLine({ takenAt: "nope", isPartial: false })).toBeNull();
  });
});

describe("pickLatestCheckin", () => {
  it("picks the later instant when SQLite text would sort the other way", () => {
    const latest = pickLatestCheckin([
      { takenAt: "2026-11-28T19:42:00.000Z", isPartial: false },
      { takenAt: "2026-11-28 19:50:00", isPartial: true },
    ]);
    expect(latest).toEqual({ takenAt: "2026-11-28 19:50:00", isPartial: true });
  });

  it("returns null when every timestamp is unusable", () => {
    expect(pickLatestCheckin([])).toBeNull();
    expect(pickLatestCheckin([{ takenAt: "yesterday", isPartial: false }])).toBeNull();
  });
});
