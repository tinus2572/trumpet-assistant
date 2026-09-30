"use client";

// Compact fingering diagram: three valves, pressed ones pushed down.
// Same drawing as the tile view's key bar (drawValves in TileView).

const VALVE_W = 6;
const GAP = 2;
const VALVE_H = 16;
const CAP_H = 3.5;
const TRAVEL = VALVE_H - CAP_H - 5;

interface MiniValvesProps {
  pistons: [boolean, boolean, boolean];
  /** Color of pressed valves */
  pressedColor: string;
  /** Color of released valves */
  releasedColor?: string;
  className?: string;
}

export default function MiniValves({
  pistons,
  pressedColor,
  releasedColor = "#52525b",
  className,
}: MiniValvesProps) {
  const width = 3 * VALVE_W + 2 * GAP;
  return (
    <svg
      viewBox={`0 0 ${width} ${VALVE_H}`}
      className={className}
      aria-hidden="true"
    >
      {pistons.map((pressed, i) => {
        const x = i * (VALVE_W + GAP);
        const capY = pressed ? TRAVEL : 0;
        const color = pressed ? pressedColor : releasedColor;
        return (
          <g key={i} className="transition-colors">
            <rect x={x + 0.25} y={0.25} width={VALVE_W - 0.5} height={VALVE_H - 0.5} rx={1.5} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
            <rect
              x={x + VALVE_W / 2 - 0.75}
              y={capY + CAP_H}
              width={1.5}
              height={VALVE_H - capY - CAP_H}
              fill={color}
            />
            <path
              d={`M${x} ${capY + CAP_H} V${capY + CAP_H / 2} a${VALVE_W / 2} ${CAP_H / 2} 0 0 1 ${VALVE_W} 0 V${capY + CAP_H} Z`}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}
