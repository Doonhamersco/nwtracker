const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KIND = "(video|thumb)\\.enc";
const LEGACY_KEY_RE = new RegExp(`^diaries/${UUID}/${KIND}$`, "i");
const USER_KEY_RE = new RegExp(`^users/([0-9a-f]{64})/diaries/${UUID}/${KIND}$`, "i");

export type DiaryKeyPurpose = "read" | "write";

type ParsedDiaryKey = {
  diaryId: string;
  kind: "video" | "thumb";
  userId: string | null;
};

export function isDiaryObjectKey(key: string): boolean {
  return LEGACY_KEY_RE.test(key) || USER_KEY_RE.test(key);
}

export function diaryVideoKey(id: string): string {
  return `diaries/${id}/video.enc`;
}

export function diaryThumbKey(id: string): string {
  return `diaries/${id}/thumb.enc`;
}

export function parseDiaryKey(key: string): ParsedDiaryKey | null {
  const prefixed = USER_KEY_RE.exec(key);
  if (prefixed) {
    const parts = key.split("/");
    return {
      userId: parts[1].toLowerCase(),
      diaryId: parts[3],
      kind: parts[4].toLowerCase().startsWith("video") ? "video" : "thumb",
    };
  }
  if (!LEGACY_KEY_RE.test(key)) return null;
  const parts = key.split("/");
  return {
    userId: null,
    diaryId: parts[1],
    kind: parts[2].toLowerCase().startsWith("video") ? "video" : "thumb",
  };
}

/**
 * New uploads always live under users/<id>/. Legacy unprefixed objects stay
 * readable by the owner only. A key that names another user is rejected.
 */
export function canonicalDiaryKey(
  key: string,
  userId: string,
  purpose: DiaryKeyPurpose,
  ownerUserId: string | null
): string {
  const parsed = parseDiaryKey(key);
  if (!parsed) throw new Error("Invalid object key");
  const current = userId.toLowerCase();
  if (parsed.userId && parsed.userId !== current) throw new Error("Invalid object key");
  const file = `${parsed.kind}.enc`;
  if (purpose === "write" || parsed.userId) {
    return `users/${current}/diaries/${parsed.diaryId}/${file}`;
  }
  if (ownerUserId && ownerUserId === current) {
    return `diaries/${parsed.diaryId}/${file}`;
  }
  throw new Error("Invalid object key");
}
