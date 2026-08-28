import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { files, fileLinkTypeEnum } from "@/db/schema";

export type FileRow = typeof files.$inferSelect;
export type FileLinkType = (typeof fileLinkTypeEnum)[number];

function getDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  // Keep uploads on the same volume as SQLite so they survive deploys.
  const dbPath =
    process.env.DB_PATH ?? path.join(process.cwd(), "data", "nwtracker.db");
  return path.dirname(dbPath);
}

function resolveStoragePath(relativePath: string): string {
  return path.join(getDataDir(), relativePath);
}

export interface SaveFileInput {
  displayName: string;
  mimeType: string;
  data: Buffer;
  linkedToType: FileLinkType;
  linkedToId: string;
}

export function saveFile(input: SaveFileInput): FileRow {
  const id = randomUUID();
  const storagePath = path.join("files", id, input.displayName);
  const absolutePath = resolveStoragePath(storagePath);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, input.data);

  db.insert(files)
    .values({
      id,
      displayName: input.displayName,
      mimeType: input.mimeType,
      sizeBytes: input.data.length,
      storagePath,
      linkedToType: input.linkedToType,
      linkedToId: input.linkedToId,
    })
    .run();

  const [row] = db.select().from(files).where(eq(files.id, id)).all();
  return row;
}

export function getFile(
  id: string
): { row: FileRow; absolutePath: string } | null {
  const [row] = db.select().from(files).where(eq(files.id, id)).all();
  if (!row) return null;

  const absolutePath = resolveStoragePath(row.storagePath);
  return { row, absolutePath };
}

export function listFiles(
  linkedToType: string,
  linkedToId: string
): FileRow[] {
  return db
    .select()
    .from(files)
    .where(
      and(
        eq(files.linkedToType, linkedToType as FileLinkType),
        eq(files.linkedToId, linkedToId)
      )
    )
    .all();
}

export function deleteFile(id: string): void {
  const result = getFile(id);
  if (!result) return;

  const { row, absolutePath } = result;

  if (fs.existsSync(absolutePath)) {
    fs.rmSync(absolutePath, { force: true });
    const dir = path.dirname(absolutePath);
    try {
      fs.rmdirSync(dir);
    } catch {
      // Directory may not be empty — that's fine
    }
  }

  db.delete(files).where(eq(files.id, row.id)).run();
}
