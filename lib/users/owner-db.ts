import fs from "fs";
import path from "path";
import { ownerEmail, userIdFromEmail } from "@/lib/users/identity";
import { usersRoot } from "@/lib/users/paths";

/**
 * The owner's sqlite file and nothing else. A symlink that leaves
 * users/<owner-id>/ is refused so a merge cannot follow it into another
 * person's data directory.
 */
export function resolveOwnerDatabaseFile(): string {
  const email = ownerEmail();
  if (!email) {
    throw new Error("ALLOWED_EMAIL is not set, so the owner database cannot be chosen");
  }

  const userId = userIdFromEmail(email);
  const users = path.resolve(usersRoot());
  const expectedDir = path.resolve(users, userId);
  const dbPath = path.resolve(expectedDir, "nwtracker.db");
  const relative = path.relative(users, dbPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Owner database path is outside the users directory");
  }
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Owner database does not exist: ${dbPath}`);
  }

  const realDir = fs.realpathSync(path.dirname(dbPath));
  const realExpected = fs.realpathSync(expectedDir);
  const realFile = fs.realpathSync(dbPath);
  if (realDir !== realExpected || path.dirname(realFile) !== realDir || path.basename(realFile) !== "nwtracker.db") {
    throw new Error("Refusing to open a database outside the owner directory");
  }
  return realFile;
}
