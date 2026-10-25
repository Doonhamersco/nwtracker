import fs from "fs";
import path from "path";
import type { UserScope } from "@/lib/users/identity";
import { EMAIL_FILE, userDir } from "@/lib/users/paths";

export function ensureUserMarker(scope: UserScope): string {
  const dir = userDir(scope.userId);
  fs.mkdirSync(dir, { recursive: true });
  const emailPath = path.join(dir, EMAIL_FILE);
  if (!fs.existsSync(emailPath)) {
    fs.writeFileSync(emailPath, `${scope.email}\n`, { mode: 0o600 });
  }
  return dir;
}
