import { NextResponse } from "next/server";
import { z } from "zod";
import { enrichChatMessage } from "@/lib/ai/enrich";
import { tutorErrorReason } from "@/lib/ai/tutor";
import { looksLikeTarget } from "@/lib/chat/shared";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Both threads store the same four columns and both are read under an RLS
 * policy that hides anything past 48 hours, so one route serves them. The
 * alternative was a second copy of the cache-hit check and the `.is(mode,
 * null)` write guard below, which are the two parts worth not duplicating.
 */
const TABLES = { room: "chat_messages", tutor: "tutor_messages" } as const;

const bodySchema = z.object({
  id: z.string().uuid(),
  mode: z.enum(["translit", "translation", "correction"]),
  source: z.enum(["room", "tutor"]).default("room"),
});

/**
 * Transliterate, translate or correct one message from either thread. The
 * result is cached on the row, so repeat clicks (and, in the room, other
 * readers) never re-bill the provider.
 */
export async function POST(req: Request) {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { id, mode, source } = parsed.data;
  const table = TABLES[source];

  // RLS hides messages past the 48h window (and, on the tutor thread, anyone
  // else's), so an expired or foreign id reads as missing.
  const { data: message } = await db
    .from(table)
    .select("id, body, translit, translation, correction")
    .eq("id", id)
    .maybeSingle();
  if (!message) return NextResponse.json({ error: "message not found" }, { status: 404 });

  const cached = message[mode];
  if (cached) return NextResponse.json({ value: cached, cached: true });

  if (!looksLikeTarget(message.body)) {
    return NextResponse.json({ error: "message is not in the target language" }, { status: 422 });
  }

  try {
    const value = await enrichChatMessage(message.body, mode);
    // `.is(mode, null)` keeps concurrent clicks from clobbering each other.
    await supabaseService()
      .from(table)
      .update({ [mode]: value })
      .eq("id", id)
      .is(mode, null);
    return NextResponse.json({ value, cached: false });
  } catch (e) {
    // Never `e.message`. The chain's failure string names providers, model ids
    // and fragments of upstream response bodies, and this route used to return
    // it verbatim - straight into a chat bubble the learner is reading.
    const failure = tutorErrorReason(e);
    return NextResponse.json(
      { reason: failure.reason, error: failure.message },
      { status: failure.status },
    );
  }
}
