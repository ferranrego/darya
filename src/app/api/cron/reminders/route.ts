import { NextResponse } from "next/server";
import webPush from "web-push";
import { supabaseService } from "@/lib/supabase/server";
import { profile as lang } from "@/lib/lang";

/**
 * Daily streak reminder, invoked by the Vercel cron declared in vercel.json.
 *
 * Vercel only attaches `Authorization: Bearer <CRON_SECRET>` when that env var
 * exists on the project. It did not exist for three weeks, so every scheduled
 * invocation was answered with a 401 that was indistinguishable from a random
 * unauthenticated probe, and not one notification was ever sent. Missing
 * configuration therefore now returns 500 with an explicit reason: an operator
 * mistake must never look like a rejected intruder.
 */

type SendOutcome = { userId: string; statusCode?: number; error?: string };

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !cronSecret) {
    console.error("[cron/reminders] CRON_SECRET is not set: cron cannot authenticate");
    return NextResponse.json(
      { error: "CRON_SECRET not configured on this deployment" },
      { status: 500 },
    );
  }

  if (isProd && req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.error("[cron/reminders] VAPID keys missing: push cannot be signed");
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const dryRun = new URL(req.url).searchParams.has("dry");

  try {
    const supabaseAdmin = supabaseService();
    webPush.setVapidDetails("mailto:admin@darya.app", publicKey, privateKey);

    // Anyone opted in who has not practised today. `last_active_date is null`
    // has to be spelled out: a bare `.neq(col, today)` is NULL for a NULL
    // column, so brand-new users — the ones who most need the nudge — were
    // silently excluded from every run.
    const today = new Date().toISOString().split("T")[0];
    const { data: usersToRemind, error: usersError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, streak_current, last_active_date")
      .eq("reminder_notifications", true)
      .or(`last_active_date.is.null,last_active_date.neq.${today}`);

    if (usersError) {
      console.error("[cron/reminders] profile query failed:", usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    const candidates = usersToRemind ?? [];
    if (candidates.length === 0) {
      console.log("[cron/reminders] candidates=0 subscriptions=0 sent=0");
      return NextResponse.json({ success: true, candidates: 0, subscriptions: 0, sent: 0 });
    }

    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in(
        "user_id",
        candidates.map((u) => u.id),
      );

    if (subsError) {
      console.error("[cron/reminders] subscription query failed:", subsError);
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    const subs = subscriptions ?? [];

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        candidates: candidates.map((u) => ({
          id: u.id,
          displayName: u.display_name,
          lastActive: u.last_active_date,
          streak: u.streak_current,
          subscriptions: subs.filter((s) => s.user_id === u.id).length,
        })),
        subscriptions: subs.length,
      });
    }

    let sent = 0;
    let expired = 0;
    const errors: SendOutcome[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          const userProfile = candidates.find((u) => u.id === sub.user_id);
          const hasStreak = !!userProfile && userProfile.streak_current > 0;

          const title = hasStreak ? "Keep your streak alive! 🔥" : "Time for your daily review! 🚀";
          const body = hasStreak
            ? `You haven't practiced ${lang.name} today. Do a quick review now to keep your streak going!`
            : `Start a new streak today by doing a quick ${lang.name} review!`;

          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({ title, body, data: { url: "/" } }),
          );
          sent++;
        } catch (e) {
          const err = e as { statusCode?: number; message?: string };
          if (err.statusCode === 404 || err.statusCode === 410) {
            // The push service has retired this endpoint for good.
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
            expired++;
          } else {
            console.error(`[cron/reminders] send failed for ${sub.user_id}:`, e);
            errors.push({
              userId: sub.user_id,
              statusCode: err.statusCode,
              error: err.message ?? String(e),
            });
          }
        }
      }),
    );

    // One structured line per run: a future zero is then visible in the Vercel
    // log with its cause, instead of an opaque `{sent: 0}`.
    console.log(
      `[cron/reminders] candidates=${candidates.length} subscriptions=${subs.length} ` +
        `sent=${sent} expired=${expired} errors=${errors.length}`,
    );

    return NextResponse.json({
      success: true,
      candidates: candidates.length,
      subscriptions: subs.length,
      sent,
      expired,
      errors,
    });
  } catch (error) {
    console.error("[cron/reminders] unexpected failure:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
