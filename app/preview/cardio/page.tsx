import { notFound } from "next/navigation";
import { CardioSection } from "@/components/dashboard/CardioSection";
import { previewTrainingConnected, previewTrainingUnconfigured } from "@/lib/strava/preview";

export const dynamic = "force-dynamic";

export default async function CardioPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const initial = params.state === "off" ? previewTrainingUnconfigured() : previewTrainingConnected();

  return (
    <div className="min-h-screen bg-bg-base px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          Sample data for layout review. Live dashboard reads Strava and Hevy.
        </p>
        <CardioSection initial={initial} />
      </div>
    </div>
  );
}
