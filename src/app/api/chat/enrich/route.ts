import { NextResponse } from "next/server";
import { z } from "zod";
import { enrichChatMessage } from "@/lib/ai/enrich";
import { DARI_SCRIPT } from "@/lib/chat/shared";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export const maxDuration = 30;

const bodySchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(["translit", "translation"]),
});

/**
 * Transliterate or translate one chat message. The result is cached on the
 * row, so repeat clicks (and other readers) never re-bill the provider.
 */
export async function POST(req: Request) {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { id, mode } = parsed.data;

  // RLS hides messages past the 48h window, so expired ids read as missing.
  const { data: message } = await db
    .from("chat_messages")
    .select("id, body, translit, translation")
    .eq("id", id)
    .maybeSingle();
  if (!message) return NextResponse.json({ error: "message not found" }, { status: 404 });

  const cached = message[mode];
  if (cached) return NextResponse.json({ value: cached, cached: true });

  if (!DARI_SCRIPT.test(message.body)) {
    return NextResponse.json({ error: "message is not in Dari script" }, { status: 422 });
  }

  try {
    const value = await enrichChatMessage(message.body, mode);
    // `.is(mode, null)` keeps concurrent clicks from clobbering each other.
    await supabaseService()
      .from("chat_messages")
      .update({ [mode]: value })
      .eq("id", id)
      .is(mode, null);
    return NextResponse.json({ value, cached: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "enrichment failed" },
      { status: 502 },
    );
  }
}
