"use client";

import { useQuery } from "@tanstack/react-query";
import { Medal, Trophy } from "lucide-react";
import { useSupabase, useUser } from "@/lib/queries/hooks";

export default function LeaderboardPage() {
  const db = useSupabase();
  const { data: user } = useUser();

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await db
        .from("profiles")
        .select("id, display_name, xp, level_estimate")
        .order("xp", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1 text-[15px] text-ink-soft">Top learners by total XP</p>
      </header>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-surface/50" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {leaderboard?.map((profile, index) => {
            const isCurrentUser = profile.id === user?.id;
            const rank = index + 1;
            
            let rankColor = "text-ink-soft";
            if (rank === 1) rankColor = "text-yellow-500";
            else if (rank === 2) rankColor = "text-slate-400";
            else if (rank === 3) rankColor = "text-amber-700";

            return (
              <div
                key={profile.id}
                className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
                  isCurrentUser ? "border-lapis bg-lapis-soft/50" : "border-line bg-surface"
                }`}
              >
                <div className={`flex w-8 justify-center font-bold ${rankColor}`}>
                  {rank <= 3 ? <Medal size={24} /> : rank}
                </div>
                
                <div className="flex-1">
                  <p className={`text-[16px] font-medium ${isCurrentUser ? "text-lapis-deep" : ""}`}>
                    {profile.display_name || "Anonymous"}
                  </p>
                  <p className="text-[13px] text-ink-soft">
                    Level {profile.level_estimate.replace("L", "")}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="text-[16px] font-semibold text-lapis">{profile.xp}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">XP</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
