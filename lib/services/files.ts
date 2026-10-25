import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { files, fileLinkTypeEnum } from "@/db/schema";
import { activeDataDir } from "@/lib/users/context";

export type FileRow = typeof files.$inferSelect;
export type FileLinkType = (typeof fileLinkTypeEnum)[number];

function resolveStoragePath(relativePath: string): string {
  const root = path.resolve(activeDataDir());
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return absolute;
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
  if (
    input.displayName.includes("..") ||
    input.displayName.includes("/") ||
    input.displayName.includes("\\")
  ) {
    throw new Error("Invalid storage path");
  }
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
