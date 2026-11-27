import { notFound } from "next/navigation";
import { PreviewFrame } from "@/app/preview/PreviewFrame";
import { SnapshotDetail } from "@/components/snapshots/SnapshotDetail";

export const dynamic = "force-dynamic";

const chase = 3635;
const isa = 1043;
const loan = 10800;

/** Dev-only view of the 27 Nov liability case, so the snapshot layout can be checked signed out. */
export default async function SnapshotPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; assets?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const mode = query.mode === "total" ? "total" : "liquid";
  const assets = query.assets === "hidden" ? "hidden" : query.assets === "shown" ? "shown" : null;

  return (
    <PreviewFrame note="Snapshot preview — sample balances, not your data">
      <SnapshotDetail
        dateLabel="27 Nov"
        notes=""
        isPartial={false}
        snapshot={{
          id: "snap-27-nov",
          takenAt: "2026-11-27T12:00:00.000Z",
          netWorthGbp: chase + isa - loan,
          physicalAssetsGbp: 0,
          isPartial: false,
        }}
        accounts={[
          {
            id: "chase",
            name: "Chase",
            category: "CASH",
            type: "ASSET",
            valueGbp: chase,
            carriedForward: false,
            netDepositGbp: null,
          },
          {
            id: "hl",
            name: "Hargreaves and Lansdown",
            category: "ISA",
            type: "ASSET",
            valueGbp: isa,
            carriedForward: false,
            netDepositGbp: null,
          },
          {
            id: "loan",
            name: "Student Loan",
            category: "STUDENT_LOAN",
            type: "LIABILITY",
            valueGbp: loan,
            carriedForward: false,
            netDepositGbp: null,
          },
        ]}
        isLatestCommitted
        currentPhysicalAssetsGbp={0}
        mode={mode}
        assets={assets}
      />
    </PreviewFrame>
  );
}
