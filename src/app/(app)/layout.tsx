import { redirect } from "next/navigation";
import { DayRollover } from "@/components/day-rollover";
import { ScrollReset } from "@/components/scroll-reset";
import { TabBar } from "@/components/tab-bar";
import { MilestoneObserver } from "@/components/ui/milestone-observer";
import { getProfile } from "@/lib/db/profiles";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/welcome");

  const profile = await getProfile(db, user.id);
  if (!profile.onboarded_at) redirect("/onboarding");

  return (
    // App shell: fixed-height with an inner scroller instead of body scroll.
    // iOS standalone PWAs misplace `position: fixed` elements when the layout
    // viewport shifts (keyboard, in-call status bar), so the tab bar anchors
    // to this shell with `absolute` rather than to the window.
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <DayRollover />
      <ScrollReset />
      <div id="app-scroll" className="flex-1 overflow-y-auto overscroll-y-contain">
        <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 pb-28 pt-6">
          {children}
        </main>
      </div>
      <TabBar />
      <MilestoneObserver />
    </div>
  );
}
