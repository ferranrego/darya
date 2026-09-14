"use client";

import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ProfileRow } from "@/lib/db/types";

/**
 * Hands the session the `(app)` layout already verified to the client cache.
 *
 * Every data hook is `enabled: !!user`, and `useUser` asked Supabase Auth for
 * the user again from the browser - the third `getUser` round trip of a page
 * load, after the proxy's and the layout's. So on every cold load nothing on
 * Home could start fetching until that request came back, and the layout's
 * profile was thrown away and fetched a second time.
 *
 * Seeded in a state initializer, not an effect: it has to run before the
 * children render, on the server and on the client alike, so both render the
 * same markup and hydration does not mismatch.
 *
 * - The user is seeded as fresh, with the normal stale time, so `useUser`
 *   behaves as it did once its first request had returned.
 * - The profile is seeded as already stale (`updatedAt: 0`): it paints at once
 *   but still refetches on mount, so XP and streak are never pinned to the
 *   moment the server rendered the page.
 *
 * Sign-in and sign-out both `qc.clear()`, and this layout remounts after
 * either, so a different learner is never shown the previous one's cache.
 */
export function SessionProvider({
  user,
  profile,
  children,
}: {
  user: User;
  profile: ProfileRow;
  children: React.ReactNode;
}) {
  const qc = useQueryClient();
  useState(() => {
    if (!qc.getQueryData(["user"])) qc.setQueryData(["user"], user);
    if (!qc.getQueryData(["profile", user.id])) {
      qc.setQueryData(["profile", user.id], profile, { updatedAt: 0 });
    }
    return null;
  });
  return <>{children}</>;
}
