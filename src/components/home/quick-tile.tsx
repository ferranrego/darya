"use client";

import Link from "next/link";

/**
 * Compact home tile: icon + title, a right-aligned metric chip, one line of
 * detail, and an optional thin progress bar. Denser and more glanceable than a
 * full ActionCard row - used in the "Keep going" 2-up shelf.
 */
export function QuickTile({
  href,
  icon,
  title,
  badge,
  detail,
  progress,
  onTapHaptic = true,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  /** Right-aligned metric chip (due count, level, x/y…). */
  badge?: React.ReactNode;
  detail?: string;
  /** 0–1; draws a slim lapis progress bar along the bottom when provided. */
  progress?: number;
  onTapHaptic?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        if (onTapHaptic && typeof navigator !== "undefined") navigator.vibrate?.(8);
      }}
      className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(31,26,23,0.06)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper text-lapis">
          {icon}
        </div>
        {badge}
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-medium leading-tight">{title}</p>
        {detail && <p className="mt-0.5 truncate text-[12.5px] text-ink-soft">{detail}</p>}
      </div>
      {progress != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-lapis transition-[width] duration-500 ease-out"
            style={{ width: `${Math.round(Math.min(Math.max(progress, 0), 1) * 100)}%` }}
          />
        </div>
      )}
    </Link>
  );
}

/** Small pill used as a QuickTile badge. */
export function TileBadge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "lapis" | "muted" | "sabz";
}) {
  const cls =
    tone === "lapis"
      ? "bg-lapis text-white"
      : tone === "sabz"
        ? "bg-sabz-soft text-sabz"
        : "bg-paper text-ink-faint border border-line";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold leading-tight ${cls}`}>{children}</span>
  );
}
