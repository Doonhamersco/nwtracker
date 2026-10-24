export interface ClusterableEvent {
  id: string;
  date: string;
  emoji: string;
  label: string;
  xValue: number;
}

export interface EventCluster {
  id: string;
  xValue: number;
  events: ClusterableEvent[];
}

export function clusterEvents(
  events: ClusterableEvent[],
  domain: [number, number],
  plotWidth: number,
  minGapPx = 28
): EventCluster[] {
  if (events.length === 0) return [];

  const [min, max] = domain;
  const span = max - min;
  if (plotWidth <= 0 || span <= 0) {
    return events.map((event) => ({
      id: event.id,
      xValue: event.xValue,
      events: [event],
    }));
  }

  const toPx = (xValue: number) => ((xValue - min) / span) * plotWidth;
  const sorted = [...events].sort((a, b) => a.xValue - b.xValue);
  const clusters: EventCluster[] = [];

  for (const event of sorted) {
    const current = clusters[clusters.length - 1];
    const previous = current?.events[current.events.length - 1];
    if (!current || !previous || toPx(event.xValue) - toPx(previous.xValue) >= minGapPx) {
      clusters.push({ id: event.id, xValue: event.xValue, events: [event] });
      continue;
    }
    current.events.push(event);
    current.xValue =
      current.events.reduce((sum, item) => sum + item.xValue, 0) / current.events.length;
  }

  return clusters;
}
