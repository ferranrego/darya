import { NextResponse } from "next/server";
import webPush from "web-push";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/server";

export const maxDuration = 30;

/** One push per recipient per window, so a busy room cannot spam. */
const THROTTLE_MINUTES = 10;
/** Ignore replays of old messages. */
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;

const bodySchema = z.object({ messageId: z.string().uuid() });

/**
 * Called by the chat_messages insert webhook (see the chat push migration),
 * never by the browser. Fans out a notification to opted-in users.
 */
export async function POST(req: Request) {
  const secret = process.env.CHAT_PUSH_SECRET;
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "push not configured" }, { status: 503 });
  }
  webPush.setVapidDetails("mailto:admin@darya.app", publicKey, privateKey);

  const db = supabaseService();

  const { data: message } = await db
    .from("chat_messages")
    .select("id, user_id, display_name, body, created_at")
    .eq("id", parsed.data.messageId)
    .maybeSingle();
  if (!message) return NextResponse.json({ error: "message not found" }, { status: 404 });

  if (Date.now() - new Date(message.created_at).getTime() > MAX_MESSAGE_AGE_MS) {
    return NextResponse.json({ sent: 0, skipped: "stale" });
  }

  const throttleCutoff = new Date(Date.now() - THROTTLE_MINUTES * 60 * 1000).toISOString();
  const { data: recipients } = await db
    .from("profiles")
    .select("id")
    .eq("chat_notifications", true)
    .neq("id", message.user_id)
    .or(`last_chat_push_at.is.null,last_chat_push_at.lt.${throttleCutoff}`);

  const recipientIds = (recipients ?? []).map((r) => r.id);
  if (recipientIds.length === 0) return NextResponse.json({ sent: 0 });

  const { data: subscriptions } = await db
    .from("push_subscriptions")
    .select("*")
    .in("user_id", recipientIds);
  if (!subscriptions || subscriptions.length === 0) return NextResponse.json({ sent: 0 });

  const payload = JSON.stringify({
    title: message.display_name || "New message",
    body: message.body.length > 120 ? `${message.body.slice(0, 119)}…` : message.body,
    data: { url: "/chat" },
  });

  const notified = new Set<string>();
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        notified.add(sub.user_id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );

  if (notified.size > 0) {
    await db
      .from("profiles")
      .update({ last_chat_push_at: new Date().toISOString() })
      .in("id", [...notified]);
  }

  return NextResponse.json({ sent: notified.size });
}
