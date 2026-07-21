import { NextResponse } from "next/server";
import webPush from "web-push";
import { supabaseService } from "@/lib/supabase/server";

export async function GET(req: Request) {
  // Verify Vercel Cron authentication
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabaseAdmin = supabaseService();

    webPush.setVapidDetails(
      "mailto:admin@darya.app",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    // Get users with an active streak but no activity today
    const today = new Date().toISOString().split("T")[0];
    const { data: usersToRemind } = await supabaseAdmin
      .from("profiles")
      .select("id, streak_current, last_active_date")
      .eq("reminder_notifications", true)
      .gt("streak_current", 0)
      .neq("last_active_date", today);

    if (!usersToRemind || usersToRemind.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const userIds = usersToRemind.map((u) => u.id);

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    let sent = 0;
    const errors: any[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            JSON.stringify({
              title: "Keep your streak alive! 🔥",
              body: "You haven't practiced Dari today. Do a quick review now to keep your streak going!",
              data: { url: "/" },
            })
          );
          sent++;
        } catch (e: any) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            // Subscription has expired or is no longer valid
            await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            errors.push(e);
          }
        }
      })
    );

    return NextResponse.json({ success: true, sent, errors });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
