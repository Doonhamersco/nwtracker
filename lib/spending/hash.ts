import { createHash } from "crypto";
import { roundPence } from "@/lib/spending/money";

export interface TransactionFingerprintInput {
  accountId: string;
  date: string;
  /** Absolute statement amount in GBP. */
  amount: number;
  direction: "in" | "out";
  descriptionRaw: string;
  balanceAfter: number;
}

/**
 * Stable id for a statement line. Re-importing the same line hashes to the
 * same primary key so ON CONFLICT DO NOTHING can skip it.
 */
export function transactionFingerprint(
  input: TransactionFingerprintInput
): string {
  const payload = [
    input.accountId,
    input.date,
    roundPence(input.amount).toFixed(2),
    input.direction,
    input.descriptionRaw,
    roundPence(input.balanceAfter).toFixed(2),
  ].join("\u001f");
  return createHash("sha256").update(payload).digest("hex");
}
