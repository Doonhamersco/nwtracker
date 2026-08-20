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
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-[#F1F5F9]">Monthly Check-in</h1>
            <Link
              href="/dashboard"
              className="text-sm text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
          <p className="text-sm text-[#94A3B8]">
            {lastDate ? `Last snapshot: ${lastDate}` : "No previous snapshot"}
            {" · "}
            {draft.accounts.length} accounts
          </p>
        </div>

        <CheckinFormClient draft={draft} />
      </div>
    </div>
  );
}
