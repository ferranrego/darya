import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface SettingsItemProps {
  href?: string;
  onClick?: () => void;
  icon: ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  rightElement?: ReactNode;
  isDestructive?: boolean;
}

export function SettingsItem({
  href,
  onClick,
  icon,
  iconBgColor = "bg-lapis-soft",
  iconColor = "text-lapis",
  title,
  subtitle,
  rightElement,
  isDestructive,
}: SettingsItemProps) {
  const content = (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconBgColor} ${iconColor}`}>
        {icon}
      </div>
      <div className="flex flex-1 flex-col justify-center overflow-hidden">
        <span className={`truncate text-[16px] font-medium leading-tight ${isDestructive ? "text-danger" : "text-ink"}`}>
          {title}
        </span>
        {subtitle && (
          <span className="truncate text-[13px] leading-tight text-ink-soft">
            {subtitle}
          </span>
        )}
      </div>
      {rightElement ? (
        <div className="shrink-0">{rightElement}</div>
      ) : (href || onClick) && !isDestructive ? (
        <ChevronRight size={18} className="shrink-0 text-ink-faint" />
      ) : null}
    </div>
  );

  const wrapperClass = "block w-full text-left transition-colors hover:bg-surface active:bg-line/30";

  if (href) {
    return (
      <Link href={href} className={wrapperClass}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={wrapperClass}>
        {content}
      </button>
    );
  }

  return <div className="w-full text-left">{content}</div>;
}

export function SettingsGroup({ children, title, footer }: { children: ReactNode; title?: string; footer?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {title && <span className="ml-4 text-[13px] font-medium uppercase tracking-wider text-ink-soft">{title}</span>}
      <div className="overflow-hidden rounded-2xl bg-surface/80 shadow-sm ring-1 ring-inset ring-line/50 backdrop-blur-md">
        <div className="flex flex-col divide-y divide-line/60">
          {children}
        </div>
      </div>
      {footer && <span className="ml-4 mr-4 mt-0.5 text-[12px] text-ink-soft">{footer}</span>}
    </div>
  );
}
