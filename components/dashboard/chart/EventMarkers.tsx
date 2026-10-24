import type { EventCluster } from "./clusterEvents";

interface EventLabelProps {
  viewBox?: { x?: number; y?: number; height?: number };
  cluster: EventCluster;
  activeClusterId: string | null;
  accentColor: string;
  chartWidth: number;
  chrome: { card: string; muted: string; border: string; text: string };
  onEnter: (id: string) => void;
  onLeave: () => void;
}

function truncate(label: string): string {
  return label.length > 28 ? `${label.slice(0, 28)}…` : label;
}

export function EventLabel({
  viewBox,
  cluster,
  activeClusterId,
  accentColor,
  chartWidth,
  chrome,
  onEnter,
  onLeave,
}: EventLabelProps) {
  const x = viewBox?.x ?? 0;
  const chartHeight = viewBox?.height ?? 0;
  const isActive = activeClusterId === cluster.id;
  const markerY = Math.max(chartHeight - 8, 16);
  const count = cluster.events.length;
  const emoji = cluster.events[0]?.emoji ?? "•";
  const lines = cluster.events.map((event) => `${event.emoji} ${truncate(event.label)}`);
  const tooltipWidth = Math.min(
    Math.max(...lines.map((line) => line.length * 6.4 + 20), 96),
    220
  );
  const tooltipHeight = 12 + lines.length * 16;
  const tooltipX = Math.max(4, Math.min(x - tooltipWidth / 2, Math.max(chartWidth - tooltipWidth - 4, 4)));
  const tooltipY = markerY - tooltipHeight - 18;

  return (
    <g>
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={markerY - 14}
        stroke={chrome.muted}
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.55}
      />
      <circle
        cx={x}
        cy={markerY}
        r={12}
        fill={chrome.card}
        stroke={isActive ? accentColor : chrome.border}
        strokeWidth={1.5}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => onEnter(cluster.id)}
        onMouseLeave={onLeave}
      />
      <text
        x={x}
        y={markerY + 4}
        textAnchor="middle"
        fontSize={11}
        style={{ cursor: "pointer", userSelect: "none" }}
        onMouseEnter={() => onEnter(cluster.id)}
        onMouseLeave={onLeave}
      >
        {emoji}
      </text>
      {count > 1 && (
        <g>
          <circle cx={x + 10} cy={markerY - 9} r={7} fill={accentColor} />
          <text
            x={x + 10}
            y={markerY - 6}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill={chrome.card}
          >
            {count}
          </text>
        </g>
      )}
      {isActive && (
        <g>
          <rect
            x={tooltipX}
            y={tooltipY}
            width={tooltipWidth}
            height={tooltipHeight}
            rx={6}
            fill={chrome.card}
            stroke={chrome.border}
            strokeWidth={1}
          />
          {lines.map((line, index) => (
            <text
              key={`${cluster.id}-${index}`}
              x={tooltipX + 10}
              y={tooltipY + 16 + index * 16}
              fontSize={11}
              fill={chrome.text}
              fontFamily="system-ui, sans-serif"
            >
              {line}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}
