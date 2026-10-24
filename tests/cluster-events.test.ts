import { describe, expect, it } from "vitest";
import { clusterEvents, type ClusterableEvent } from "@/components/dashboard/chart/clusterEvents";

function event(id: string, xValue: number): ClusterableEvent {
  return { id, date: "2026-03-02", emoji: "🏠", label: id, xValue };
}

describe("clusterEvents", () => {
  const domain: [number, number] = [0, 1000];

  it("groups markers that would sit on top of each other", () => {
    const clusters = clusterEvents(
      [event("a", 100), event("b", 112), event("c", 400)],
      domain,
      280
    );
    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.events.map((item) => item.id)).toEqual(["a", "b"]);
    expect(clusters[1]?.events.map((item) => item.id)).toEqual(["c"]);
  });

  it("keeps distant markers separate", () => {
    const clusters = clusterEvents([event("a", 100), event("b", 500)], domain, 280, 28);
    expect(clusters).toHaveLength(2);
  });

  it("does not collapse everything when the plot width is unknown", () => {
    const clusters = clusterEvents([event("a", 100), event("b", 101)], domain, 0);
    expect(clusters).toHaveLength(2);
  });
});
