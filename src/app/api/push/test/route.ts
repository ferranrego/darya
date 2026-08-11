import { NextResponse } from "next/server";
import webPush from "web-push";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

/**
 * Sends a push to the caller's own subscriptions and reports what the push
 * service actually said.
 *
 * Push used to be unverifiable without waiting a day for the cron, which is
 * how a missing CRON_SECRET stayed invisible for three weeks. The per-endpoint
 * status code is the payload that matters: 201 delivered, 403 the deployment's
 * VAPID keypair does not match the one the subscription was created with,
 * 410 the endpoint is dead (this route reaps it, so re-enabling notifications
 * once restores delivery).
 */
export async function POST() {
  const supabase = await supabaseServer();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "Push is not configured on this deployment" }, { status: 503 });
  }
  webPush.setVapidDetails("mailto:admin@darya.app", publicKey, privateKey);

  const userId = userData.user.id;
  const db = supabaseService();

  const { data: subscriptions, error } = await db
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("[push/test] subscription lookup failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json(
      { sent: 0, results: [], error: "No push subscription is stored for this account" },
      { status: 404 },
    );
  }

  const payload = JSON.stringify({
    title: "Push is working ✅",
    body: "This is a test notification. Daily reminders will arrive the same way.",
    data: { url: "/profile" },
  });

  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const res = await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        return { endpoint: sub.endpoint.slice(0, 48), ok: true, statusCode: res.statusCode };
      } catch (e) {
        const err = e as { statusCode?: number; body?: string; message?: string };
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
        return {
          endpoint: sub.endpoint.slice(0, 48),
          ok: false,
          statusCode: err.statusCode,
          error: err.body || err.message || String(e),
        };
      }
    }),
  );

  const sent = results.filter((r) => r.ok).length;
  console.log(`[push/test] user=${userId} subscriptions=${results.length} sent=${sent}`);
  return NextResponse.json({ sent, results });
}
