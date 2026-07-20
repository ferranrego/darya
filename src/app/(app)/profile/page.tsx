"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flame, LogOut, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/db/profiles";
import { useProfile, useSignOut, useSupabase, useUser, useUserWords } from "@/lib/queries/hooks";

const RATIOS = [
  { value: 0.02, label: "Gentle", detail: "~2% new words" },
  { value: 0.05, label: "Standard", detail: "~5% new words" },
  { value: 0.1, label: "Challenge", detail: "~10% new words" },
] as const;

const GOALS = [15, 30, 60] as const;

export default function ProfilePage() {
  const db = useSupabase();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { data: words } = useUserWords();
  const signOut = useSignOut();

  const patch = useMutation({
    mutationFn: async (p: { new_word_ratio?: number; daily_goal?: number }) => {
      if (!user) return;
      await updateProfile(db, user.id, p);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const knownCount = words?.filter((w) => w.status === "known").length ?? 0;

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-8">
      <header className="pt-2">
        <h1 className="text-[26px] font-semibold tracking-tight">{profile.display_name}</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          Level {profile.level_estimate.replace("L", "")} · {knownCount} words known · {profile.xp} XP
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <Flame size={20} className="text-saffron" />
          <div>
            <p className="text-[20px] font-semibold leading-tight">{profile.streak_current}</p>
            <p className="text-[12px] text-ink-soft">day streak</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <Trophy size={20} className="text-lapis" />
          <div>
            <p className="text-[20px] font-semibold leading-tight">{profile.streak_best}</p>
            <p className="text-[12px] text-ink-soft">best streak</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold">New words per text</h2>
        <p className="mt-0.5 text-[13px] text-ink-soft">
          How much unknown vocabulary generated texts should contain.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {RATIOS.map((r) => {
            const active = Math.abs(profile.new_word_ratio - r.value) < 0.005;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => patch.mutate({ new_word_ratio: r.value })}
                aria-pressed={active}
                className={`rounded-2xl border px-3 py-3 text-center transition-all duration-200 ${
                  active ? "border-lapis bg-lapis-soft text-lapis" : "border-line bg-surface hover:border-ink-faint"
                }`}
              >
                <p className="text-[14px] font-medium">{r.label}</p>
                <p className={`text-[11px] ${active ? "text-lapis/70" : "text-ink-faint"}`}>{r.detail}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[15px] font-semibold">Daily goal</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {GOALS.map((g) => {
            const active = profile.daily_goal === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => patch.mutate({ daily_goal: g })}
                aria-pressed={active}
                className={`rounded-2xl border px-3 py-3 text-center transition-all duration-200 ${
                  active ? "border-lapis bg-lapis-soft text-lapis" : "border-line bg-surface hover:border-ink-faint"
                }`}
              >
                <p className="text-[14px] font-medium">{g} XP</p>
              </button>
            );
          })}
        </div>
      </section>

      <button
        type="button"
        onClick={async () => {
          await signOut.mutateAsync();
          router.push("/welcome");
          router.refresh();
        }}
        className="flex items-center gap-2 self-start text-[14px] text-ink-soft transition-colors hover:text-danger"
      >
        <LogOut size={16} />
        Sign out
      </button>
    </div>
  );
}
