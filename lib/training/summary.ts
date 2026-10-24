import { formatKm } from "@/lib/strava/metrics";
import type { TrainingPayload } from "./types";

/** One line for the Overview tile. Empty pieces are left out so a missing source does not pad the row. */
export function fitnessSummaryLine(
  data: Pick<TrainingPayload, "countdownDays" | "strava" | "hevy">,
): string {
  const parts: string[] = [];

  if (data.countdownDays > 1) parts.push(`${data.countdownDays} days to test`);
  else if (data.countdownDays === 1) parts.push("1 day to test");
  else if (data.countdownDays === 0) parts.push("Test today");

  if (data.strava.configured && "summary" in data.strava) {
    parts.push(`${formatKm(data.strava.summary.weeklyDistanceKm)} km this week`);
  }

  if (data.hevy.available) {
    const sessions = data.hevy.workoutsThisWeek;
    parts.push(`${sessions} strength ${sessions === 1 ? "session" : "sessions"}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Cardio, strength, and weight";
}
