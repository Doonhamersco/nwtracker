/**
 * Backfill historical net worth snapshots.
 *
 * Data points:
 *   - 2021-01-01: £0 net worth (age 16)
 *   - 2024-01-01: ~£157,960 net worth ($200,000 USD at Jan 2024 rate of 0.7898)
 *
 * These are inserted as non-partial snapshots with netWorthGbp set but no
 * per-account valuations, since we only have total figures for this period.
 */

import { db } from "./client";
import { snapshots, fxRates } from "./schema";
import { and, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";

// Historical USD→GBP rate for January 2024 (mid-market, ~15 Jan 2024)
const USD_GBP_JAN_2024 = 0.7898;
const USD_AMOUNT_JAN_2024 = 200_000;
const GBP_JAN_2024 = Math.round(USD_AMOUNT_JAN_2024 * USD_GBP_JAN_2024);

const entries = [
  {
    date: "2021-01-01",
    takenAt: "2021-01-01 12:00:00",
    netWorthGbp: 0,
    usdAmount: null as number | null,
    usdGbpRate: null as number | null,
    label: "£0 (age 16)",
  },
  {
    date: "2024-01-01",
    takenAt: "2024-01-01 12:00:00",
    netWorthGbp: GBP_JAN_2024,
    usdAmount: USD_AMOUNT_JAN_2024,
    usdGbpRate: USD_GBP_JAN_2024,
    label: `£${GBP_JAN_2024.toLocaleString()} ($${USD_AMOUNT_JAN_2024.toLocaleString()} USD @ ${USD_GBP_JAN_2024} rate)`,
  },
];

async function main() {
  for (const entry of entries) {
    const dayStart = `${entry.date} 00:00:00`;
    const dayEnd = `${entry.date} 23:59:59`;

    // Check for existing snapshot on this date
    const existing = db
      .select()
      .from(snapshots)
      .where(and(gte(snapshots.takenAt, dayStart), lte(snapshots.takenAt, dayEnd)))
      .all();

    if (existing.length > 0) {
      console.log(`Skipped ${entry.date} — snapshot already exists (id=${existing[0].id})`);
      continue;
    }

    const snapshotId = randomUUID();

    db.insert(snapshots)
      .values({
        id: snapshotId,
        takenAt: entry.takenAt,
        netWorthGbp: entry.netWorthGbp,
        isPartial: false,
        notes: `Historical backfill: ${entry.label}`,
      })
      .run();

    // If this snapshot has a USD amount, record the FX rate used
    if (entry.usdAmount !== null && entry.usdGbpRate !== null) {
      db.insert(fxRates)
        .values({
          id: randomUUID(),
          snapshotId,
          fromCurrency: "USD",
          toCurrency: "GBP",
          rate: entry.usdGbpRate,
          source: "manual",
        })
        .run();
      console.log(
        `Inserted snapshot for ${entry.date}: ${entry.label} (with USD→GBP FX rate ${entry.usdGbpRate})`
      );
    } else {
      console.log(`Inserted snapshot for ${entry.date}: ${entry.label}`);
    }
  }

  console.log("\nBackfill complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
