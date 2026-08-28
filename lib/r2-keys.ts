const OBJECT_KEY_RE =
  /^diaries\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(video|thumb)\.enc$/i;

export function isDiaryObjectKey(key: string): boolean {
  return OBJECT_KEY_RE.test(key);
}

export function diaryVideoKey(id: string): string {
  return `diaries/${id}/video.enc`;
}

export function diaryThumbKey(id: string): string {
  return `diaries/${id}/thumb.enc`;
}
