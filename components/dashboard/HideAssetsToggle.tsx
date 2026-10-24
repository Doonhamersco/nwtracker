"use client";

interface HideAssetsToggleProps {
  hideAssets: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function HideAssetsToggle({
  hideAssets,
  onToggle,
  compact = false,
}: HideAssetsToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hideAssets}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        hideAssets
          ? "bg-accent/15 text-accent"
          : "text-muted hover:text-text hover:bg-bg-hover"
      }`}
    >
      {hideAssets
        ? compact
          ? "Accounts"
          : "Accounts (assets hidden)"
        : "Hide assets"}
    </button>
  );
}
