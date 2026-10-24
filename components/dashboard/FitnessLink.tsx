"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { fitnessSummaryLine } from "@/lib/training/summary";
import type { TrainingPayload } from "@/lib/training/types";

export function FitnessLink({ summary }: { summary?: string }) {
  const [line, setLine] = useState(summary ?? "Cardio, strength, and weight");

  useEffect(() => {
    if (summary) return;
    let cancelled = false;
    fetch("/api/training")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as TrainingPayload;
      })
      .then((payload) => {
        if (cancelled || !payload) return;
        setLine(fitnessSummaryLine(payload));
      })
      .catch(() => {
        // The static label is enough when training data is unreachable.
      });
    return () => {
      cancelled = true;
    };
  }, [summary]);

  return (
    <Link href="/fitness" className="block">
      <Card
        padding="compact"
        className="flex items-center justify-between gap-4 text-sm transition-colors hover:bg-bg-hover"
      >
      <span className="font-medium text-text">Fitness</span>
      <span className="min-w-0 truncate text-muted">{line}</span>
      <span className="shrink-0 text-accent">Open →</span>
      </Card>
    </Link>
  );
}
