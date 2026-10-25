import { AsyncLocalStorage } from "async_hooks";
import fs from "fs";
import {
  ownerEmail,
  scopeFromEmail,
  userIdFromEmail,
  type UserScope,
} from "@/lib/users/identity";
import { dataRoot, migrationMarkerPath, userDbPath, userDir } from "@/lib/users/paths";
import { readRequestIdentity } from "@/lib/users/request-user";

const storage = new AsyncLocalStorage<UserScope>();

export function currentScope(): UserScope | null {
  const fromAls = storage.getStore();
  if (fromAls) return fromAls;

  const request = readRequestIdentity();
  if (request.email) {
    const scope = scopeFromEmail(request.email);
    if (!scope) throw new Error("Signed-in user is not on the invite list");
    return scope;
  }
  if (request.inRequest) {
    throw new Error("Signed-in user is required to access data");
  }
  return null;
}

export function requireUser(): UserScope {
  const scope = currentScope();
  if (!scope) throw new Error("Signed-in user is required to access data");
  return scope;
}

export function runAsUser<T>(email: string, fn: () => T): T {
  const scope = scopeFromEmail(email);
  if (!scope) throw new Error("User is not on the invite list");
  return storage.run(scope, fn);
}

export function enterUser(email: string): UserScope {
  const scope = scopeFromEmail(email);
  if (!scope) throw new Error("User is not on the invite list");
  storage.enterWith(scope);
  return scope;
}

/** CLI backfills follow the owner after the one-time move, and the legacy file before it. */
export function enterOwnerIfMigrated(): void {
  const owner = ownerEmail();
  if (!owner) return;
  const migrated =
    fs.existsSync(migrationMarkerPath()) ||
    fs.existsSync(userDbPath(userIdFromEmail(owner)));
  if (migrated) enterUser(owner);
}

export function activeDataDir(): string {
  const scope = currentScope();
  if (!scope) return dataRoot();
  return userDir(scope.userId);
}
