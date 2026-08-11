import { NextResponse } from "next/server";
import { z } from "zod";
import { generateTutorReply, tutorErrorReason, type TutorTurn } from "@/lib/ai/tutor";
import { deadlineIn } from "@/lib/ai/providers";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat/shared";
import { cefrOf, levelById } from "@/lib/content/load";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import type { TutorMessageRow } from "@/lib/db/types";

export const maxDuration = 30;

/**
 * Budget for the single completion, inside a 30s route.
 *
 * Leaves ~10s for the two inserts, the profile read and the platform's own
 * overhead. `completeJson` gives each attempt what is left of this, so the tail
 * of the chain still gets a real try when Groq is slow rather than being
 * skipped with milliseconds to spare.
 */
const REPLY_BUDGET_MS = 20_000;

/** What the model is shown. See `HISTORY_TURNS` - this only has to cover it. */
const HISTORY_ROWS = 10;

const bodySchema = z.object({
  body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

/**
 * One turn of conversation: store what the learner wrote, ask the chain for a
 * reply, store that too, and hand both rows back so the client renders without
 * a second round trip.
 *
 * Both inserts go through the service role because `tutor_messages` has no
 * client write policy - the browser must not be able to decide how many model
 * calls get made against a quota every learner on the deployment shares.
 */
export async function POST(req: Request) {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const body = parsed.data.body;

  const service = supabaseService();

  // History and level in parallel: neither depends on the other, and this runs
  // before the completion, so its latency is on the learner's critical path.
  const [{ data: history }, { data: profileRow }] = await Promise.all([
    db
      .from("tutor_messages")
      .select("role, body")
      .order("created_at", { ascending: false })
      .limit(HISTORY_ROWS),
    db.from("profiles").select("level_estimate").eq("id", user.id).maybeSingle(),
  ]);

  const turns: TutorTurn[] = ((history ?? []) as TutorTurn[]).slice().reverse();

  // The insert is what enforces the spend limits (see the table's trigger), so
  // it has to happen before the completion, not alongside it.
  const { data: userRow, error: insertError } = await service
    .from("tutor_messages")
    .insert({ user_id: user.id, role: "user", body })
    .select()
    .single();

  if (insertError || !userRow) {
    const failure = tutorErrorReason(insertError);
    return NextResponse.json(
      { reason: failure.reason, error: failure.message },
      { status: failure.status },
    );
  }

  let cefr: string;
  try {
    cefr = cefrOf(levelById(profileRow?.level_estimate ?? "L1"));
  } catch {
    // An unknown level id must not cost the learner their turn; the level only
    // tunes the register, and A1 is the safe direction to be wrong in.
    cefr = "A1";
  }

  let reply: string;
  try {
    reply = await generateTutorReply([...turns, { role: "user", body }], cefr, deadlineIn(REPLY_BUDGET_MS));
  } catch (e) {
    // The learner's own message is already stored and is returned here, so the
    // thread does not lose what they wrote when the provider chain is down.
    const failure = tutorErrorReason(e);
    return NextResponse.json(
      { reason: failure.reason, error: failure.message, userMessage: userRow as TutorMessageRow },
      { status: failure.status },
    );
  }

  const { data: tutorRow, error: replyError } = await service
    .from("tutor_messages")
    .insert({ user_id: user.id, role: "tutor", body: reply })
    .select()
    .single();

  if (replyError || !tutorRow) {
    const failure = tutorErrorReason(replyError);
    return NextResponse.json(
      { reason: failure.reason, error: failure.message, userMessage: userRow as TutorMessageRow },
      { status: failure.status },
    );
  }

  return NextResponse.json({
    userMessage: userRow as TutorMessageRow,
    tutorMessage: tutorRow as TutorMessageRow,
  });
}
