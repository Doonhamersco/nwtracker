import { notFound } from "next/navigation";
import { FitnessClient } from "@/components/fitness/FitnessClient";
import { PreviewFrame } from "@/app/preview/PreviewFrame";
import {
  previewHevyMetrics,
  previewHevyStats,
  previewWeightReadings,
  previewWorkouts,
} from "@/lib/fitness/preview";
import { previewTrainingConnected } from "@/lib/strava/preview";

export const dynamic = "force-dynamic";

export default function FitnessPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <PreviewFrame note="Sample data for layout review. The live Fitness page reads Strava, Hevy, and saved weight.">
      <FitnessClient
        initialWeightReadings={previewWeightReadings()}
        hevyMetrics={previewHevyMetrics()}
        initialTraining={previewTrainingConnected()}
        initialWorkouts={previewWorkouts()}
        initialHevyStats={previewHevyStats()}
      />
    </PreviewFrame>
  );
}
