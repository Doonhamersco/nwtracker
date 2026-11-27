import type { AccountMove, ChartDataPoint, SeriesKey } from "./types";
import { formatFullGbp, formatSignedGbp } from "./format";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  visible: Set<SeriesKey>;
  hideDebt: boolean;
  onOpen?: (snapshotId: string) => void;
}

function visibleMoves(moves: AccountMove[], hideDebt: boolean): AccountMove[] {
  return hideDebt ? moves.filter((move) => move.type !== "LIABILITY") : moves;
}

export function ChartTooltip({ active, payload, visible, hideDebt, onOpen }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const current = point.value;
  const change =
    current !== null && point.prev !== undefined ? current - point.prev : null;
  const dayGap =
    point.prevTs !== undefined ? Math.round((point.ts - point.prevTs) / 86_400_000) : null;
  const changeLabel =
    dayGap !== null && dayGap >= 20 && dayGap <= 45 ? "Month change" : "Since previous";
  const moves = visibleMoves(point.moves, hideDebt).slice(0, 4);
  const hiddenCount = visibleMoves(point.moves, hideDebt).length - moves.length;

  const snapshotId = point.snapshotId;
  return (
    <div
      className={`min-w-[180px] max-w-[240px] rounded-xl border border-border bg-bg-card px-3.5 py-2.5 shadow-lg ${
        snapshotId ? "cursor-pointer hover:border-accent" : ""
      }`}
      role={snapshotId ? "link" : undefined}
      tabIndex={snapshotId ? 0 : undefined}
      onClick={() => {
        if (snapshotId) onOpen?.(snapshotId);
      }}
      onKeyDown={(event) => {
        if (!snapshotId) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(snapshotId);
        }
      }}
      onTouchEnd={() => {
        if (snapshotId) onOpen?.(snapshotId);
      }}
    >
      <p className="mb-1 text-xs text-muted">{point.date}</p>
      {visible.has("netWorth") && current !== null && (
        <>
          <p className="font-mono text-base font-medium tabular-nums text-text">
            {formatFullGbp(current)}
          </p>
          {change !== null && (
            <p className={`mt-0.5 text-xs ${change >= 0 ? "text-positive" : "text-negative"}`}>
              {changeLabel} {formatSignedGbp(change)}
            </p>
          )}
        </>
      )}
      {visible.has("weight") && point.weight !== null && (
        <p className="mt-1 font-mono text-xs text-weight">{point.weight.toFixed(1)} kg</p>
      )}
      {visible.has("netWorth") && moves.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
          {moves.map((move, index) => (
            <li key={`${move.name}-${index}`} className="flex items-baseline justify-between gap-3 text-[11px]">
              <span className="truncate text-muted">{move.name}</span>
              <span
                className={`shrink-0 font-mono tabular-nums ${
                  move.deltaGbp >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {formatSignedGbp(move.deltaGbp)}
              </span>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="text-[11px] text-placeholder">+{hiddenCount} more</li>
          )}
        </ul>
      )}
      {snapshotId && <p className="mt-2 text-[11px] text-accent">View snapshot</p>}
    </div>
  );
}
