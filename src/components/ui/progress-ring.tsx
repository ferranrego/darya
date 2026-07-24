"use client";

/** Daily-goal ring. Sweeps once on mount per DESIGN.md (600ms ease-in-out). */
export function ProgressRing({
  value,
  max,
  size = 120,
  stroke = 9,
  trackColor = "var(--line)",
  progressColor,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  /** Ring background track. Override on dark surfaces (e.g. the night hero). */
  trackColor?: string;
  /** In-progress stroke. Defaults to lapis, flips to saffron when the goal is met. */
  progressColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = max > 0 ? Math.min(value / max, 1) : 0;
  const done = fraction >= 1;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={progressColor ?? (done ? "var(--saffron)" : "var(--lapis)")}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 600ms ease-in-out, stroke 300ms" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
