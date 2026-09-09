/**
 * Why a model call failed, in terms a learner can act on.
 *
 * The provider chain throws one string containing every attempt's error -
 * `All providers failed: groq#0: groq 429: rate limit…` - which is exactly what
 * a maintainer needs and exactly what a learner must never see: it names
 * providers, models and status codes. Collapsing all of it to "try again in a
 * moment" is the other extreme, and it is what the import feature shipped with:
 * a learner whose article would not translate, and a maintainer reading their
 * bug report, both learned nothing.
 *
 * So: classify once, here, and let each feature supply its own wording. The
 * knowledge of what a provider failure looks like lives in one place, because
 * two copies of these patterns is how one of them goes stale.
 */

export type AiFailure =
  /** Quota, rate limit or credits - nothing is wrong with the request. */
  | "busy"
  /** Ran out of the request's time budget. The same input may work now. */
  | "slow"
  /** A per-user cap this app applies, not the provider's. */
  | "limit"
  /**
   * Every provider answered, and every answer failed validation. This is the
   * one that means the *request* is the problem - too long, too complex, or a
   * shape the models keep getting wrong - and it is the one a generic "try
   * again" is actively misleading about, because trying again will fail too.
   */
  | "invalid"
  /** Anything else. */
  | "failed";

export function messageOf(e: unknown): string {
  // Not just `e instanceof Error`: a Postgres trigger's exception arrives as a
  // plain PostgrestError object, which stringifies to "[object Object]".
  return typeof e === "object" && e !== null && "message" in e
    ? String((e as { message: unknown }).message)
    : String(e);
}

export function classifyAiFailure(e: unknown): AiFailure {
  const raw = messageOf(e);

  if (/tutor_rate_limit/.test(raw)) return "limit";

  // Checked before "busy": an aborted attempt often also carries a 429 from an
  // earlier provider in the same message, and running out of time is the more
  // actionable thing to say - the same request may succeed now.
  if (/abort|timed? ?out|ms left/i.test(raw)) return "slow";

  if (/\b(429|402)\b|rate limit|quota|credits|skipped/i.test(raw)) return "busy";

  // Validators in this directory throw plain sentences, and `completeJson`
  // concatenates them. If no attempt produced a transport-level error, the
  // models were reachable and their *output* is what kept being rejected.
  if (/All providers failed/.test(raw) && !/\b[45]\d\d\b/.test(raw)) return "invalid";

  return "failed";
}
