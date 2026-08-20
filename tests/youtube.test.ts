import { describe, it, expect } from "vitest";
import { parseYouTubeVideoId, youtubeWatchUrl, youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/youtube";

describe("parseYouTubeVideoId", () => {
  const id = "dQw4w9WgXcQ";

  it("accepts a bare 11-character ID", () => {
    expect(parseYouTubeVideoId(id)).toBe(id);
  });

  it("parses watch URLs", () => {
    expect(parseYouTubeVideoId(`https://www.youtube.com/watch?v=${id}`)).toBe(id);
    expect(parseYouTubeVideoId(`https://youtube.com/watch?v=${id}&t=30s`)).toBe(id);
    expect(parseYouTubeVideoId(`https://m.youtube.com/watch?v=${id}`)).toBe(id);
  });

  it("parses youtu.be short links", () => {
    expect(parseYouTubeVideoId(`https://youtu.be/${id}`)).toBe(id);
    expect(parseYouTubeVideoId(`https://youtu.be/${id}?t=12`)).toBe(id);
  });

  it("parses embed, shorts, and live URLs", () => {
    expect(parseYouTubeVideoId(`https://www.youtube.com/embed/${id}`)).toBe(id);
    expect(parseYouTubeVideoId(`https://www.youtube-nocookie.com/embed/${id}`)).toBe(id);
    expect(parseYouTubeVideoId(`https://www.youtube.com/shorts/${id}`)).toBe(id);
    expect(parseYouTubeVideoId(`https://www.youtube.com/live/${id}`)).toBe(id);
  });

  it("parses URLs without a scheme", () => {
    expect(parseYouTubeVideoId(`youtube.com/watch?v=${id}`)).toBe(id);
    expect(parseYouTubeVideoId(`youtu.be/${id}`)).toBe(id);
  });

  it("returns null for invalid input", () => {
    expect(parseYouTubeVideoId("")).toBeNull();
    expect(parseYouTubeVideoId("not-a-url")).toBeNull();
    expect(parseYouTubeVideoId("https://vimeo.com/12345")).toBeNull();
    expect(parseYouTubeVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});

describe("youtube URL helpers", () => {
  const id = "dQw4w9WgXcQ";

  it("builds watch, embed, and thumbnail URLs", () => {
    expect(youtubeWatchUrl(id)).toBe(`https://www.youtube.com/watch?v=${id}`);
    expect(youtubeEmbedUrl(id)).toBe(`https://www.youtube-nocookie.com/embed/${id}`);
    expect(youtubeThumbnailUrl(id)).toBe(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  });
});
