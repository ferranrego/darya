import { redirect } from "next/navigation";
import { DayRollover } from "@/components/day-rollover";
import { TabBar } from "@/components/tab-bar";
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
    <div className="flex min-h-dvh flex-col">
      <DayRollover />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-28 pt-6">{children}</main>
      <TabBar />
    </div>
  );
}
