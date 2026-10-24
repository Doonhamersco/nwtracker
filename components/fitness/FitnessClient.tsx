"use client";

import { useState } from "react";
import Link from "next/link";
import HevyWidget from "@/app/components/HevyWidget";
import { CardioSection } from "@/components/dashboard/CardioSection";
import { Card } from "@/components/ui/Card";
import { WeightManager, type WeightReading } from "@/components/dashboard/WeightManager";
import { HevyWorkouts } from "@/components/fitness/HevyWorkouts";
import type { HevyStats, HevyWorkout } from "@/lib/hevy/types";
import type { HevyCheckinMetric } from "@/lib/fitness/types";
import type { TrainingPayload } from "@/lib/training/types";

function formatCheckin(value: number, unit: string): string {
  const digits = unit === "kg" || unit === "sessions" || unit === "PRs" ? 0 : 1;
  const formatted = value.toLocaleString("en-GB", { maximumFractionDigits: digits });
  return unit ? `${formatted} ${unit}` : formatted;
}

export function FitnessClient({
  initialWeightReadings,
  hevyMetrics,
  initialTraining,
  initialWorkouts,
  initialHevyStats,
}: {
  initialWeightReadings: WeightReading[];
  hevyMetrics: HevyCheckinMetric[];
  initialTraining?: TrainingPayload;
  initialWorkouts?: HevyWorkout[];
  initialHevyStats?: HevyStats;
}) {
  const [weightReadings, setWeightReadings] = useState(initialWeightReadings);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight text-text">Fitness</h1>
        <p className="mt-1 text-sm text-muted">
          Runs from Strava, and strength, workouts, and weight from Hevy.
        </p>
      </header>

      <CardioSection initial={initialTraining} />

      <HevyWidget initial={initialHevyStats} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="flex flex-col">
          <h2 className="mb-5 font-display text-xl font-medium text-text">Weight</h2>
          <WeightManager readings={weightReadings} onReadingsChange={setWeightReadings} />
        </Card>
        <HevyWorkouts initial={initialWorkouts} />
      </div>

      {hevyMetrics.length > 0 && (
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl font-medium text-text">Hevy check-ins</h2>
            <Link href="/metrics" className="text-sm text-accent hover:text-accent-hover">
              Life Metrics →
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted">Latest saved readings from the monthly check-in.</p>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {hevyMetrics.map((metric) => (
              <div key={metric.id} className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                  {metric.name}
                </p>
                <p className="mt-1 font-display text-2xl font-medium tabular-nums text-text">
                  {metric.value == null ? "—" : formatCheckin(metric.value, metric.unit)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
