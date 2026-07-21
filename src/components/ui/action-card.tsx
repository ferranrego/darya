import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** Tappable row: icon tile, title + subtitle, chevron. Used on Home and the You hub. */
export function ActionCard({
  href,
  icon,
  title,
  subtitle,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-2xl border p-4 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(31,26,23,0.06)] ${
        accent ? "border-lapis/25 bg-lapis-soft/60" : "border-line bg-surface"
      }`}
    >
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
          accent ? "bg-lapis text-white" : "bg-paper text-lapis"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-medium">{title}</p>
        {subtitle && <p className="truncate text-[13px] text-ink-soft">{subtitle}</p>}
      </div>
      <ChevronLeft
        className="rotate-180 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5"
        size={18}
      />
    </Link>
  );
}
