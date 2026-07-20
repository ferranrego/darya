import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint, keys, platform } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
    }

    // Upsert subscription
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userData.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        platform: platform || "web",
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.error("Error saving push subscription:", error);
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing push subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
