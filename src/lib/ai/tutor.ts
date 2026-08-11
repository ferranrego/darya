import { z } from "zod";
import { profile } from "../lang";
import { completeJson } from "./providers";

/**
 * The conversation partner: one model call per learner turn, and nothing else.
 *
 * This is the first feature in the app where the number of provider calls is
 * set by the learner rather than by the content, so every knob here is a cost
 * knob. The three that matter, and must not be loosened without re-reading
 * CLAUDE.md's "Cost and time":
 *
 *   - one call per turn. No repair pass, no second opinion, no auto-correction
 *     of what the learner wrote. Corrections stay a tap, cached on the row.
 *   - a bounded history. `HISTORY_TURNS` messages, each already capped at 500
 *     characters by the schema, so the prompt cannot grow with the session.
 *   - no vocabulary list. The prompt names the learner's CEFR level and stops
 *     there. Sending the known-word set is what exhausted a day's quota for
 *     every learner in one session when the reader's slice went 160 -> 600.
 */

export interface TutorTurn {
  role: "user" | "tutor";
  body: string;
}

/**
 * How much of the conversation the model sees.
 *
 * Ten turns is roughly five exchanges - enough that "and you?" resolves and a
 * topic survives a couple of messages, which is the whole point of a chat over
 * an exercise. Beyond that the prompt grows without the conversation getting
 * better, and it grows on *every* subsequent turn, so the cost is quadratic in
 * a session rather than linear.
 */
const HISTORY_TURNS = 10;

/** Two short sentences plus a question, with room for RTL punctuation. */
const MAX_REPLY_TOKENS = 200;

// Matches the column's own check constraint. Rejecting here costs a retry, so
// the bound is the storage limit rather than a style preference - "two short
// sentences" is enforced by the prompt and by `max_tokens`, not by parsing.
const replySchema = z.object({ reply: z.string().min(1).max(800) });

/**
 * The prompt for one reply. Pure, and exported for tests: the guarantees that
 * matter here (bounded history, no word list, the literal token "JSON") are
 * properties of this string and are otherwise only observable by spending a
 * provider call to find out.
 */
export function buildTutorPrompt(history: TutorTurn[], cefr: string): string {
  const recent = history.slice(-HISTORY_TURNS);
  const transcript = recent
    .map((t) => `${t.role === "user" ? "Learner" : "You"}: ${t.body}`)
    .join("\n");

  return [
    profile.prompts.chat.tutorPersona,
    "",
    `The learner is at CEFR level ${cefr}. Match that level: use the vocabulary and sentence length someone at ${cefr} can actually read, and do not show off.`,
    "",
    "Rules:",
    `- Reply in ${profile.name} only. Do not translate yourself into English, and do not add a transliteration - the app provides both on demand.`,
    "- At most two short sentences.",
    "- End with a question, so there is something for the learner to answer.",
    "- Do not correct the learner's mistakes. Understand what they meant and reply to that; a separate button handles corrections, and interrupting a conversation to correct it is how people stop talking.",
    `- If the learner writes in English, reply in ${profile.name} anyway, but keep it very simple.`,
    profile.prompts.syntax ? `- ${profile.prompts.syntax}` : "",
    "",
    transcript
      ? `The conversation so far:\n${transcript}`
      : "The learner has just opened the chat and said nothing yet. Greet them.",
    "",
    'Return ONLY JSON: {"reply": "..."}',
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateTutorReply(
  history: TutorTurn[],
  cefr: string,
  deadline: number,
): Promise<string> {
  return completeJson(buildTutorPrompt(history, cefr), {
    // Groq first: the learner is watching three dots. Its LPU returns a reply
    // of this length in about a second where the HF router takes three to six,
    // and at two sentences of A1-B2 register the quality gap is not visible.
    // The rest of the chain still sits behind it untouched.
    prefer: ["groq"],
    maxTokens: MAX_REPLY_TOKENS,
    temperature: 0.7,
    deadline,
    validate: (raw) => replySchema.parse(JSON.parse(raw)).reply.trim(),
  });
}

/** Why a turn failed, in terms the UI can branch on. */
export type TutorFailure = "busy" | "slow" | "limit" | "failed";

interface FailureCopy {
  reason: TutorFailure;
  status: number;
  /** Ready to render. Deliberately says nothing about providers or models. */
  message: string;
}

const COPY: Record<TutorFailure, Omit<FailureCopy, "reason">> = {
  busy: {
    status: 503,
    message: `${profile.brand.mascotName} is talking to a lot of learners right now. Try again in a few minutes.`,
  },
  slow: {
    status: 504,
    message: "That took too long to come back. Try sending it again.",
  },
  limit: {
    status: 429,
    message: `You've been chatting a lot - ${profile.brand.mascotName} needs a short break. Come back in a little while.`,
  },
  failed: {
    status: 502,
    message: `${profile.brand.mascotName} couldn't reply just now. Try again in a moment.`,
  },
};

/**
 * Classify a thrown error into something a learner can be shown.
 *
 * The chain's own failure message is `All providers failed: groq#0: groq 429:
 * {"error":...} | openrouter#1: ...`, which names providers, model ids and
 * fragments of upstream response bodies. That string reached a chat bubble in
 * production via /api/chat/enrich. Nothing that comes out of `completeJson`
 * may be forwarded to a client; it goes through here first.
 */
export function tutorErrorReason(e: unknown): FailureCopy {
  // Not just `e instanceof Error`: the trigger's exception arrives as a plain
  // PostgrestError object from supabase-js, which stringifies to
  // "[object Object]" and was therefore classified as a generic failure - the
  // learner who hit their daily cap was told to "try again in a moment".
  const raw =
    typeof e === "object" && e !== null && "message" in e
      ? String((e as { message: unknown }).message)
      : String(e);

  // The Postgres trigger's own exception text, surfaced by supabase-js.
  if (/tutor_rate_limit/.test(raw)) return { reason: "limit", ...COPY.limit };

  // Checked before "busy": an aborted attempt often *also* carries a 429 from
  // an earlier provider in the same message, and running out of time is the
  // more actionable thing to tell someone - the same message may work now.
  if (/abort|timed? ?out|ms left/i.test(raw)) return { reason: "slow", ...COPY.slow };

  if (/\b(429|402)\b|rate limit|quota|credits|skipped/i.test(raw)) {
    return { reason: "busy", ...COPY.busy };
  }

  return { reason: "failed", ...COPY.failed };
}
