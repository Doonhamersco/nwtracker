import { canonicalDiaryKey, isDiaryObjectKey } from "@/lib/r2-keys";
import { currentScope } from "@/lib/users/context";
import { ownerUserId } from "@/lib/users/identity";

export function scopedDiaryObjectKey(key: string, purpose: "read" | "write"): string {
  const scope = currentScope();
  if (!scope) {
    if (!isDiaryObjectKey(key)) throw new Error("Invalid object key");
    return key;
  }
  return canonicalDiaryKey(key, scope.userId, purpose, ownerUserId());
}
