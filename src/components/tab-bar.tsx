"use client";

import { BookOpen, Home, MessageCircle, RotateCcw, User } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
      className="fixed bottom-0 inset-x-0 z-40 w-full pb-[max(env(safe-area-inset-bottom),12px)] pointer-events-none"
    >
      <div className="mx-auto flex max-w-[360px] items-center justify-center px-4 pointer-events-auto">
        <div className="flex w-full items-center justify-between rounded-full border border-line/70 bg-paper/90 backdrop-blur-xl p-1.5 shadow-lg">
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
                className={`relative flex h-12 items-center justify-center rounded-full transition-colors ${
                  active ? "text-lapis px-4" : "text-ink-faint hover:text-ink-soft px-3"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId={reduced ? undefined : "tab-pill-expanding"}
                    className="absolute inset-0 rounded-full bg-lapis-soft"
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 500, damping: 35, mass: 0.8 }
                    }
                  />
                )}

                <div className="relative z-10 flex items-center">
                  <span className="relative flex items-center justify-center">
                    <motion.span
                      className="block"
                      animate={{ scale: active && !reduced ? 1.05 : 1 }}
                      whileTap={reduced ? undefined : { scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <Icon 
                        size={22} 
                        strokeWidth={active ? 2.5 : 2} 
                        className={active ? "fill-lapis/20" : "fill-transparent"} 
                      />
                    </motion.span>
                    {badge > 0 && (
                      <span
                        aria-hidden
                        className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lapis px-1 text-[10px] font-semibold leading-none text-white shadow-[0_0_0_2px_var(--color-paper)]"
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </span>
                  
                  <AnimatePresence>
                    {active && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.8 }}
                        className="overflow-hidden"
                      >
                        <span className="block whitespace-nowrap pl-2 text-[14px] font-bold">
                          {label}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

