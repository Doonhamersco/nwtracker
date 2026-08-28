export type MetricCategory = "gym" | "finance";

export function metricCategory(metric: {
  isHevyMetric: boolean;
  name?: string;
  metricName?: string;
}): MetricCategory {
  const name = metric.name ?? metric.metricName ?? "";
  if (metric.isHevyMetric || name === "Body Weight") return "gym";
  return "finance";
}

export function partitionMetrics<T extends { isHevyMetric: boolean; name?: string; metricName?: string }>(
  metrics: T[]
): { gym: T[]; finance: T[] } {
  const gym: T[] = [];
  const finance: T[] = [];
  for (const metric of metrics) {
    if (metricCategory(metric) === "gym") gym.push(metric);
    else finance.push(metric);
  }
  return { gym, finance };
}
