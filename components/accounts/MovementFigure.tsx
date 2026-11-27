import type { AccountMovement } from "@/lib/engine/account-movement";

export function MovementFigure({ movement }: { movement: AccountMovement }) {
  if (movement.amount === null) return <span className="text-xs text-muted">—</span>;
  const positive = movement.amount >= 0;
  return (
    <span className="inline-flex flex-col items-end">
      <span className={`font-mono text-sm ${positive ? "text-positive" : "text-negative"}`}>
        {positive ? "▲" : "▼"} £
        {Math.abs(movement.amount).toLocaleString("en-GB", { maximumFractionDigits: 0 })}
        {movement.percent !== null && (
          <span className="ml-1 text-xs opacity-75">
            ({movement.percent >= 0 ? "+" : ""}
            {movement.percent.toFixed(1)}%)
          </span>
        )}
      </span>
      {movement.kind === "growth" && movement.hint && (
        <span className="text-[11px] text-muted">{movement.hint}</span>
      )}
    </span>
  );
}
