export const DEFAULT_ACCENT_COLOR = "#c5a059";

export const ACCENT_PRESETS = [
  "#c5a059",
  "#c4785a",
  "#7d9a6f",
  "#6b8cae",
  "#c47a8a",
] as const;

/** Default Warm Ledger tokens — used when the accent is still gold. */
export const DEFAULT_PALETTE = {
  accent: DEFAULT_ACCENT_COLOR,
  accentHover: "#b48d45",
  positive: DEFAULT_ACCENT_COLOR,
  muted: "#9a8d7a",
  placeholder: "#6b6156",
  border: "#2a261f",
  borderStrong: "#3d372e",
  bgHover: "#1c1914",
  bgCard: "#141210",
} as const;

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

export function isHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

export function isAvatarMimeType(value: string): value is AvatarMimeType {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(value);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function mixHex(from: string, toward: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(toward);
  return rgbToHex(
    a.r + (b.r - a.r) * amount,
    a.g + (b.g - a.g) * amount,
    a.b + (b.b - a.b) * amount
  );
}

/** Darken a #rrggbb color toward black. Default 12% matches the original gold hover. */
export function darkenHex(hex: string, amount = 0.12): string {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - amount;
  return rgbToHex(r * f, g * f, b * f);
}

export type ThemePalette = {
  accent: string;
  accentHover: string;
  positive: string;
  muted: string;
  placeholder: string;
  border: string;
  borderStrong: string;
  bgHover: string;
  bgCard: string;
};

/**
 * Build a dark palette from one accent. Gold keeps the original Warm Ledger
 * tokens; any other colour tints muted text, borders, and hover surfaces
 * so the whole chrome follows the choice — not just font colour.
 */
export function paletteFromAccent(accent: string): ThemePalette {
  const hex = accent.toLowerCase();
  if (hex === DEFAULT_ACCENT_COLOR) {
    return { ...DEFAULT_PALETTE };
  }
  return {
    accent: hex,
    accentHover: darkenHex(hex, 0.12),
    positive: hex,
    muted: mixHex(DEFAULT_PALETTE.muted, hex, 0.42),
    placeholder: mixHex(DEFAULT_PALETTE.placeholder, hex, 0.32),
    border: mixHex(DEFAULT_PALETTE.border, hex, 0.22),
    borderStrong: mixHex(DEFAULT_PALETTE.borderStrong, hex, 0.28),
    bgHover: mixHex(DEFAULT_PALETTE.bgHover, hex, 0.16),
    bgCard: mixHex(DEFAULT_PALETTE.bgCard, hex, 0.12),
  };
}

export function themeCssVars(accent: string): Record<string, string> {
  const p = paletteFromAccent(accent);
  return {
    "--nw-accent": p.accent,
    "--nw-accent-hover": p.accentHover,
    "--nw-positive": p.positive,
    "--nw-muted": p.muted,
    "--nw-placeholder": p.placeholder,
    "--nw-border": p.border,
    "--nw-border-strong": p.borderStrong,
    "--nw-bg-hover": p.bgHover,
    "--nw-bg-card": p.bgCard,
    "--color-accent": p.accent,
    "--color-accent-hover": p.accentHover,
    "--color-positive": p.positive,
    "--color-muted": p.muted,
    "--color-placeholder": p.placeholder,
    "--color-border": p.border,
    "--color-border-strong": p.borderStrong,
    "--color-bg-hover": p.bgHover,
    "--color-bg-card": p.bgCard,
  };
}

export function themeStyleText(accent: string): string {
  const vars = themeCssVars(accent);
  const body = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `:root{${body}}`;
}
