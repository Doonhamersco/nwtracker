"use client";

interface DebtToggleProps {
  hasDebt: boolean;
  hideDebt: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export function DebtToggle({
  hasDebt,
  hideDebt,
  onToggle,
  compact = false,
}: DebtToggleProps) {
  if (!hasDebt) {
    return (
      <span
        role="status"
        className="whitespace-nowrap rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-950 shadow-[0_0_18px_rgba(16,185,129,0.45)]"
      >
        NO DEBT WOOHOO
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hideDebt}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        hideDebt
          ? "bg-accent/15 text-accent"
          : "text-muted hover:text-text hover:bg-bg-hover"
      }`}
    >
      {hideDebt
        ? compact
          ? "Liquid"
          : "Liquid (debt hidden)"
        : "Hide debt"}
    </button>
  );
}
