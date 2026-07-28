"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, BookOpen, Flame, Library, LogOut, Trophy, Bell, Settings2, BookType, Hash, Skull } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { levelLabel } from "@/lib/content/load";
import { updateProfile } from "@/lib/db/profiles";
import { useProfile, useSignOut, useSupabase, useUser, useUserWords } from "@/lib/queries/hooks";
import { useSettingsStore, type ReadingFont } from "@/lib/settings-store";
import { usePushSubscription } from "@/lib/use-push-subscription";
import { ProfileHero } from "@/components/profile/profile-hero";
import { SettingsGroup, SettingsItem } from "@/components/profile/settings-group";
import { SleekSelector } from "@/components/profile/sleek-selector";
import { FontCarousel } from "@/components/profile/font-carousel";
import { ToggleSwitch } from "@/components/profile/toggle-switch";
import { hapticTap } from "@/lib/util/haptics";

const RATIOS = [
  { value: 0.02, label: "Gentle", detail: "~2% new words" },
  { value: 0.05, label: "Standard", detail: "~5% new words" },
  { value: 0.1, label: "Challenge", detail: "~10% new words" },
  { 
    value: 0.25, 
    label: "Extreme", 
    danger: true, 
    detail: (
      <span className="flex items-center gap-1.5 font-bold text-danger">
        <Skull size={14} className="animate-bounce" />
        ~25% new words. Enter the Danger Zone!
      </span>
    )
  },
];

const GOALS = [
  { value: 15, label: "15 XP" },
  { value: 30, label: "30 XP" },
  { value: 60, label: "60 XP" },
];

const FONTS: { value: ReadingFont; label: string; desc: string; targetPreview?: boolean }[] = [
  { value: "vazirmatn", label: "Vazirmatn", desc: "Modern UI", targetPreview: true },
  { value: "scheherazade", label: "Scheherazade", desc: "Traditional", targetPreview: true },
  { value: "amiri", label: "Amiri", desc: "Classic Serif", targetPreview: true },
  { value: "lateef", label: "Lateef", desc: "Elegant Naskh", targetPreview: true },
];

export default function ProfilePage() {
  const db = useSupabase();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { data: words } = useUserWords();
  const signOut = useSignOut();
  const { readingFont, setReadingFont } = useSettingsStore();
  const { isSupported, isSubscribed, isSubscribing, subscribe } = usePushSubscription();
  const reduce = useReducedMotion();

  const patch = useMutation({
    mutationFn: async (p: {
      new_word_ratio?: number;
      daily_goal?: number;
      chat_notifications?: boolean;
      reminder_notifications?: boolean;
    }) => {
      if (!user) return;
      await updateProfile(db, user.id, p);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const knownCount = words?.filter((w) => w.status === "known").length ?? 0;

  if (!profile) return null;

  const stagger = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 15 },
          animate: { opacity: 1, y: 0 },
          transition: { type: "spring" as const, stiffness: 260, damping: 26, delay },
        };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <ProfileHero 
        displayName={profile.display_name || "Learner"}
        levelText={levelLabel(profile.level_estimate)}
        knownCount={knownCount}
        xp={profile.xp}
        streakCurrent={profile.streak_current}
        streakBest={profile.streak_best}
      />



      <motion.section {...stagger(0.15)}>
        <SettingsGroup title="Activity">
          <SettingsItem
            href="/words"
            icon={<Library size={18} />}
            iconBgColor="bg-lapis-soft"
            iconColor="text-lapis"
            title="My Words"
            subtitle={`${knownCount} known · browse by theme`}
          />
          <SettingsItem
            href="/profile/history"
            icon={<BookOpen size={18} />}
            iconBgColor="bg-saffron-soft"
            iconColor="text-saffron"
            title="Reading History"
            subtitle="Revisit texts you've read"
          />
          <SettingsItem
            href="/leaderboard"
            icon={<Trophy size={18} />}
            iconBgColor="bg-[#e4efe8]" // sabz-soft
            iconColor="text-[#3e7c59]" // sabz
            title="Leaderboard"
            subtitle="Top learners by total XP"
          />
          <SettingsItem
            href="/stats"
            icon={<BarChart3 size={18} />}
            iconBgColor="bg-line/50"
            iconColor="text-ink-soft"
            title="Detailed Stats"
            subtitle="Progress over time"
          />
        </SettingsGroup>
      </motion.section>

      <motion.section {...stagger(0.2)}>
        <SettingsGroup title="Preferences">
          <div className="flex flex-col gap-3 px-4 py-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Hash size={16} className="text-lapis" />
                <span className="text-[15px] font-medium text-ink">New words per text</span>
              </div>
              <SleekSelector
                options={RATIOS}
                value={profile.new_word_ratio || 0.05}
                onChange={(val) => patch.mutate({ new_word_ratio: val })}
              />
            </div>
          </div>
          
          <div className="flex flex-col gap-3 border-t border-line/60 px-4 py-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Settings2 size={16} className="text-saffron" />
                <span className="text-[15px] font-medium text-ink">Daily goal</span>
              </div>
              <SleekSelector
                options={GOALS}
                value={profile.daily_goal || 30}
                onChange={(val) => patch.mutate({ daily_goal: val })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-line/60 px-4 py-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <BookType size={16} className="text-[#3e7c59]" />
                <span className="text-[15px] font-medium text-ink">Reading Font</span>
              </div>
              <p className="mb-3 text-[13px] text-ink-soft">Choose the font for reading Dari texts.</p>
              <FontCarousel
                options={FONTS}
                value={readingFont || "vazirmatn"}
                onChange={(val) => setReadingFont(val)}
              />
            </div>
          </div>
        </SettingsGroup>
      </motion.section>

      {isSupported && (
        <motion.section {...stagger(0.25)}>
          <SettingsGroup title="Notifications" footer="Get daily streak reminders and updates.">
            {!isSubscribed ? (
              <SettingsItem
                onClick={() => {
                  hapticTap();
                  subscribe();
                }}
                icon={<Bell size={18} />}
                iconBgColor="bg-surface"
                iconColor="text-lapis"
                title={isSubscribing ? "Subscribing..." : "Enable Notifications"}
                subtitle="Stay on top of your learning"
              />
            ) : (
              <>
                <SettingsItem
                  icon={<Bell size={18} />}
                  iconBgColor="bg-lapis-soft"
                  iconColor="text-lapis"
                  title="Chat messages"
                  subtitle="When someone writes in chat"
                  rightElement={
                    <ToggleSwitch
                      checked={!!profile.chat_notifications}
                      onChange={(checked) => patch.mutate({ chat_notifications: checked })}
                    />
                  }
                />
                <SettingsItem
                  icon={<Flame size={18} />}
                  iconBgColor="bg-saffron-soft"
                  iconColor="text-saffron"
                  title="Daily reminders"
                  subtitle="Remind me to catch up"
                  rightElement={
                    <ToggleSwitch
                      checked={!!profile.reminder_notifications}
                      onChange={(checked) => patch.mutate({ reminder_notifications: checked })}
                    />
                  }
                />
              </>
            )}
          </SettingsGroup>
        </motion.section>
      )}

      <motion.section {...stagger(0.3)}>
        <SettingsGroup>
          <SettingsItem
            onClick={async () => {
              hapticTap();
              await signOut.mutateAsync();
              router.push("/welcome");
              router.refresh();
            }}
            icon={<LogOut size={18} />}
            iconBgColor="bg-danger/10"
            iconColor="text-danger"
            title="Sign out"
            isDestructive={true}
          />
        </SettingsGroup>
      </motion.section>
    </div>
  );
}
