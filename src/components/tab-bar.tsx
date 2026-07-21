"use client";

import { BookOpen, Home, MessageCircle, RotateCcw, User } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDueCount } from "@/lib/queries/hooks";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/read", label: "Read", icon: BookOpen },
  { href: "/review", label: "Review", icon: RotateCcw },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/profile", label: "You", icon: User },
] as const;

/**
 * Bottom tab bar: the app's single translucent surface (see DESIGN.md).
 * Five destinations, per the HIG/Material cap; Words and Leaderboard live in
 * the You hub. The lapis pill slides between tabs to answer "where am I".
 */
export function TabBar() {
  const pathname = usePathname();
  const due = useDueCount();
  const reduced = useReducedMotion();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 min-h-[var(--tab-bar-h)] w-full border-t border-line/70 bg-paper/80 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const badge = href === "/review" && due > 0 ? due : 0;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={badge ? `${label}, ${badge} due` : label}
              onClick={(e) => {
                navigator.vibrate?.(8);
                // Repeat-tap on the current tab scrolls to top instead of navigating.
                if (active) {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
                }
              }}
              className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 pb-2 pt-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-lapis" : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              <div className="relative flex h-8 w-14 items-center justify-center">
                {active && (
                  <motion.span
                    layoutId={reduced ? undefined : "tab-pill"}
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-lapis-soft"
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 400, damping: 32, mass: 0.8 }
                    }
                  />
                )}
                <span className="relative z-10 flex items-center justify-center">
                  <motion.span
                    className="block"
                    animate={{ scale: active && !reduced ? 1.06 : 1 }}
                    whileTap={reduced ? undefined : { scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                  </motion.span>
                  {badge > 0 && (
                    <span
                      aria-hidden
                      className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lapis px-1 text-[10px] font-semibold leading-none text-white"
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
              </div>

              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
