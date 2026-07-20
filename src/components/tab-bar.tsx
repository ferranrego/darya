"use client";

import { BookOpen, Home, Library, RotateCcw, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/read", label: "Read", icon: BookOpen },
  { href: "/words", label: "Words", icon: Library },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/profile", label: "Profile", icon: User },
] as const;

/** Bottom tab bar: the app's single translucent surface (see DESIGN.md). */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-line/70 bg-paper/80 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-16 flex-col items-center gap-1 px-4 pb-2 pt-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-lapis" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
