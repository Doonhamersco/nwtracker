import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { notableEvents } from "@/db/schema";
import type { CreateEventInput, UpdateEventInput } from "@/lib/validators/events";

export type NotableEventRow = typeof notableEvents.$inferSelect;

export function listEvents(): NotableEventRow[] {
  return db.select().from(notableEvents).orderBy(desc(notableEvents.date)).all();
}

export function getEventById(id: string): NotableEventRow | null {
  const [row] = db.select().from(notableEvents).where(eq(notableEvents.id, id)).all();
  return row ?? null;
}

export function createEvent(input: CreateEventInput): NotableEventRow {
  const id = randomUUID();
  db.insert(notableEvents)
    .values({ id, date: input.date, emoji: input.emoji, label: input.label })
    .run();
  const [row] = db.select().from(notableEvents).where(eq(notableEvents.id, id)).all();
  return row;
}

export function updateEvent(id: string, input: UpdateEventInput): NotableEventRow {
  const existing = getEventById(id);
  if (!existing) throw new Error(`Notable event not found: ${id}`);

  db.update(notableEvents)
    .set({
      ...(input.date !== undefined && { date: input.date }),
      ...(input.emoji !== undefined && { emoji: input.emoji }),
      ...(input.label !== undefined && { label: input.label }),
    })
    .where(eq(notableEvents.id, id))
    .run();

  const [row] = db.select().from(notableEvents).where(eq(notableEvents.id, id)).all();
  return row;
}

export function deleteEvent(id: string): void {
  db.delete(notableEvents).where(eq(notableEvents.id, id)).run();
}
