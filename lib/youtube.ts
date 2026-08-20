const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extract an 11-character YouTube video ID from a URL or a bare ID.
 * Accepts watch, youtu.be, embed, shorts, and live URLs.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (VIDEO_ID_RE.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0]?.split("?")[0];
    return id && VIDEO_ID_RE.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID_RE.test(v)) return v;

    const parts = url.pathname.split("/").filter(Boolean);
    if (
      parts.length >= 2 &&
      ["embed", "shorts", "live", "v"].includes(parts[0] ?? "")
    ) {
      const id = parts[1];
      return id && VIDEO_ID_RE.test(id) ? id : null;
    }
  }

  return null;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
