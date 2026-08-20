import Link from "next/link";
import { buildCheckinDraft } from "@/lib/services/checkin";
import { CheckinFormClient } from "@/components/checkin/CheckinFormClient";

export const metadata = {
  title: "Monthly Check-in — nwTracker",
};

export default async function CheckinPage() {
  const draft = await buildCheckinDraft();

  const lastDate = draft.lastSnapshotDate
    ? new Date(draft.lastSnapshotDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
            <h1 className="font-display text-3xl font-medium tracking-tight text-text">Monthly Check-in</h1>
            <Link
              href="/dashboard"
              className="text-sm text-muted hover:text-text transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
          <p className="text-sm text-muted">
            {lastDate ? `Last snapshot: ${lastDate}` : "No previous snapshot"}
            {" · "}
            {draft.accounts.length} accounts
          </p>
        </div>

        <CheckinFormClient draft={draft} />
    </div>
  );
}
