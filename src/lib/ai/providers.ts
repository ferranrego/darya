

/**
 * The shared free-tier provider chain: an ordered list of OpenAI-compatible
 * endpoints, each tried twice before falling through to the next.
 */

interface Provider {
  name: string;
  available: () => boolean;
  call: (
    prompt: string,
    temperature: number,
    timeoutMs: number,
    maxTokens?: number,
  ) => Promise<string>;
}

/**
 * Timeouts are a *shared deadline*, not a per-provider constant.
 *
 * The chain is five providers deep and each was tried twice with its own 30s
 * budget, which is 300 seconds of provider time inside a route that Vercel
 * kills at 60 (`maxDuration`), and at 30 on the chat routes - where a single
 * provider timeout is already the whole invocation. The later providers could
 * therefore never run: the function died first, having spent the tokens, with
 * nothing cached and a non-JSON 504 the client cannot parse.
 *
 * So the caller says how long the whole operation may take, and each attempt
 * gets what is left of it. That keeps the ordering meaningful - a fast provider
 * failing early leaves plenty for the next - and it degrades honestly, giving
 * "all providers failed" with real errors instead of a killed process.
 *
 * The per-call cap still matters on top of the deadline: OpenRouter's free tier
 * *queues*, so without a ceiling one slow provider would eat a budget that four
 * others could have used.
 */
const PER_CALL_CAP_MS = 25_000;

/**
 * Below this there is no point starting another request; the response would
 * arrive after the deadline anyway. Stopping here leaves room to return a real
 * error rather than being killed mid-flight.
 */
const MIN_USEFUL_MS = 3_000;

/**
 * Default when a caller does not set one. Sized for the *smallest* route that
 * reaches this code (`maxDuration = 30` on the chat routes), because being
 * killed by the platform is worse than giving up a few seconds early.
 */
const DEFAULT_BUDGET_MS = 24_000;

/**
 * Providers that have failed in a way that will not clear on its own.
 *
 * An exhausted monthly allowance (402) or a bad key (401/403) is the same
 * answer every time, but the chain re-tries the provider on every call - and a
 * single generation is three calls, each spending the per-call cap discovering
 * the same thing. Observed with Hugging Face out of credits at the head of the
 * chain: it consumed the whole 45s budget across the run and the working
 * providers behind it were skipped with milliseconds left.
 *
 * Held for the life of the process, not persisted: a redeploy or a topped-up
 * account should get a clean try, and a serverless instance is short-lived
 * anyway. A timeout is deliberately not included - that is transient, and a
 * provider that is merely slow now may be fine on the next request.
 */
const disabled = new Map<string, string>();

/**
 * Extra body fields for one provider.
 *
 * Every provider here speaks the OpenAI shape, but the *reasoning* controls are
 * each vendor's own, and the defaults are not neutral: a reasoning model left
 * alone will happily spend the whole `max_tokens` thinking and return a
 * truncated answer, or emit its thoughts into `content` where they are not
 * JSON. Both are silent - the chain just sees a parse failure and moves on,
 * having paid for the tokens. So the model choice and the reasoning settings
 * that make it behave travel together, on the same line.
 */
type ExtraBody = Record<string, unknown>;

function openAiCompatible(
  name: string,
  baseUrl: string,
  keyEnv: string,
  modelEnv: string,
  defaultModel: string,
  extraBody: ExtraBody = {},
): Provider {
  return {
    name,
    available: () => !!process.env[keyEnv],
    async call(prompt, temperature, timeoutMs, maxTokens) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env[keyEnv]}`,
          },
          body: JSON.stringify({
            model: process.env[modelEnv] ?? defaultModel,
            messages: [{ role: "user", content: prompt }],
            temperature,
            response_format: { type: "json_object" },
            // Only meaningful when the model override still names the model
            // these were chosen for. Setting GROQ_MODEL to something that
            // rejects them is the one way to make this a 400 - which the chain
            // treats as fatal for that provider, so it fails loudly per call
            // rather than degrading.
            ...extraBody,
            // Omitted unless asked for: every other caller wants JSON of a known
            // shape, where a cap can only truncate it into a parse failure that
            // costs a retry. It exists for free-form prose (the tutor reply),
            // where nothing else bounds the response.
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
          }),
          signal: controller.signal,
        });
        
        if (!res.ok) throw new Error(`${name} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) throw new Error(`${name}: empty response`);
        return text;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/**
 * Ordered by preference, not by cost - every one of these is free.
 *
 * The defaults must name a model the account can actually reach.
 * `Qwen/Qwen2.5-32B-Instruct` sat at the head of this list and does not exist
 * on the router ("not supported by any provider you have enabled"), so every
 * generation spent two failed requests before falling through to Groq, and the
 * head of the chain was dead weight. Verify a new default with a real call
 * before shipping it; a 400 here is silent, because the chain recovers.
 *
 * The Groq slots held `groq/compound`/`groq/compound-mini` until Groq announced
 * their decommissioning. Compound was an agentic system - built-in tool use and
 * web search - and nothing here ever wanted either, so the replacements are
 * plain instruct models. Qwen takes the Groq head for the same reason it heads
 * the chain on the HF router: it is the better Persian morphologist, and this
 * slot serves the tutor reply and translation. A model vanishing from a
 * provider's catalog is the silent-failure case this file is built around, so
 * when a default here starts 400ing, replace it rather than letting the chain
 * absorb it.
 */
const providers: Provider[] = [
  openAiCompatible("huggingface", "https://router.huggingface.co/v1", "HUGGINGFACE_API_KEY", "HUGGINGFACE_MODEL", "Qwen/Qwen2.5-72B-Instruct"),
  // Both of these are qwen3.8's current defaults, and both are set anyway.
  // Measured, not assumed: left alone it answers in 6 completion tokens with
  // clean JSON, so nothing here is repairing a live failure. What it is
  // guarding is the inheritance - `reasoning_effort` defaults "vary by model"
  // by Groq's own documentation, and the one value JSON mode *rejects*
  // outright is `reasoning_format: raw`, with a 400 the chain treats as fatal
  // for the provider. A default drifting into that is a slot going dark for
  // the life of the process, so the settings this slot needs are stated rather
  // than inherited.
  openAiCompatible("groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL", "qwen/qwen3.8-27b", {
    reasoning_format: "hidden",
    reasoning_effort: "none",
  }),
  openAiCompatible("openrouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "openrouter/free"),
  // GPT-OSS takes neither of the settings above: `reasoning_format` is not its
  // parameter (`include_reasoning` is, and the two are mutually exclusive) and
  // it rejects `reasoning_effort: none` outright. Hence two configurations for
  // one vendor - they are not interchangeable, and a copy-paste between these
  // two lines is a 400.
  //
  // It always reasons, and those tokens are billed and counted: measured on the
  // same trivial prompt, 40 completion tokens at its default `medium` against
  // 29 at `low`. The reasoning arrives in its own field rather than in
  // `content`, so this costs budget and latency rather than correctness - but
  // budget is the constraint that actually binds here, and this is the slot
  // whose job is to be quick.
  openAiCompatible("groq-fallback", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL_FALLBACK", "openai/gpt-oss-20b", {
    include_reasoning: false,
    reasoning_effort: "low",
  }),
  // Qwen3-32B, which sat here, is a *hybrid* reasoning model, and the HF router
  // offers no dependable switch for the thinking - what works depends on which
  // upstream serves the request. Its output was never malformed; the cost is
  // tokens. Measured on one arithmetic question whose answer is about ten
  // tokens long, it spent 220. The -Instruct line has no thinking mode to
  // switch off, so the saving comes from the model choice rather than from a
  // parameter this endpoint may quietly ignore, and A3B's 3B active parameters
  // are what a last-resort fallback should cost.
  openAiCompatible("huggingface-fallback", "https://router.huggingface.co/v1", "HUGGINGFACE_API_KEY", "HUGGINGFACE_MODEL_FALLBACK", "Qwen/Qwen3-Next-80B-A3B-Instruct"),
];

interface CompleteOptions<T> {
  temperature?: number;
  /** Parse and check one raw response. Throwing rejects that attempt. */
  validate: (raw: string, providerName: string) => T;
  /**
   * Absolute time by which the whole chain must be done. Callers that make
   * several sequential completions should create one deadline and pass it to
   * all of them, so the budget covers the operation rather than each step.
   */
  deadline?: number;
  /**
   * Provider names to try first, in this order.
   *
   * Different features want different heads: a chat reply the learner is
   * watching wants Groq, which answers in about a second, while a grammar
   * correction wants Qwen on the HF router, which is the better morphologist
   * and worth three seconds for a deliberate tap.
   *
   * A *reordering*, never a filter: everything unnamed keeps its relative
   * position behind the preferred names, so the chain stays five deep and no
   * amount of preferring can strand a caller with one dead provider.
   */
  prefer?: string[];
  /** Cap on response length. Only meaningful for free-form prose; see `call`. */
  maxTokens?: number;
}

/** `providers`, with `prefer` names hoisted to the front, order preserved. */
function ordered(prefer?: string[]): Provider[] {
  if (!prefer?.length) return providers;
  const rank = (p: Provider) => {
    const i = prefer.indexOf(p.name);
    return i === -1 ? prefer.length : i;
  };
  // Stable, so providers sharing a rank (i.e. every unpreferred one) keep the
  // chain's own ordering, which encodes the quality/latency trade already made.
  return [...providers].sort((a, b) => rank(a) - rank(b));
}

/**
 * Remove a reasoning preamble a model put in `content` instead of keeping to
 * itself, and return what follows.
 *
 * No provider in the chain does this today - all five were checked live, and
 * every one of them puts reasoning in its own response field and leaves
 * `content` clean. This is therefore a guard, not a repair, and it is kept for
 * one specific reason: `openrouter/free` is an *auto-router* that picks
 * whichever free model is up, so the model behind that slot changes without
 * anything in this repo changing. The check above served
 * `nex-agi/nex-n2.5-mini:free`, which is itself a reasoning model. A future
 * pick that inlines its thoughts would turn every OpenRouter attempt into a
 * parse failure - two attempts, both paid for, and an error naming nothing.
 *
 * Unclosed `<think>` is handled deliberately: it means the answer was truncated
 * mid-thought, and there is no JSON coming. Cutting to the end leaves an empty
 * string, which fails validation immediately instead of after a confusing
 * partial parse.
 */
export function stripReasoning(raw: string): string {
  const text = raw.trimStart();
  if (!text.startsWith("<think>") && !text.startsWith("<reasoning>")) return raw;
  const close = text.match(/<\/(?:think|reasoning)>/);
  return close ? text.slice(close.index! + close[0].length).trim() : "";
}

/**
 * Ask the chain for one JSON completion. The prompt must contain the word
 * "JSON" - providers require it alongside `response_format: json_object`.
 */
export async function completeJson<T>(prompt: string, opts: CompleteOptions<T>): Promise<T> {
  const errors: string[] = [];
  const deadline = opts.deadline ?? Date.now() + DEFAULT_BUDGET_MS;

  for (const provider of ordered(opts.prefer)) {
    if (!provider.available()) continue;
    const why = disabled.get(provider.name);
    if (why) {
      errors.push(`${provider.name}: skipped, ${why}`);
      continue;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_USEFUL_MS) {
        errors.push(`${provider.name}#${attempt}: skipped, ${remaining}ms left`);
        return failed(errors);
      }
      try {
        let raw = await provider.call(
          prompt,
          opts.temperature ?? 0.8,
          Math.min(PER_CALL_CAP_MS, remaining),
          opts.maxTokens,
        );
        // Order matters: the fence, when there is one, is inside the answer
        // and therefore after any reasoning block, never around it.
        raw = stripReasoning(raw);
        // Strip markdown backticks if present
        if (raw.startsWith("```json")) {
          raw = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (raw.startsWith("```")) {
          raw = raw.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        return opts.validate(raw, provider.name);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`${provider.name}#${attempt}: ${message}`);
        // Some failures a second identical request cannot fix, and retrying
        // them spends budget the rest of the chain needs. Hand over at once:
        //
        //   429 / quota   the limit will not clear this minute, and on a daily
        //                 quota not today either.
        //   402           out of credits; nothing about a retry buys more.
        //   aborted       our own timeout fired. OpenRouter's free tier queues,
        //                 so a retry is another full budget slice spent waiting
        //                 for the same queue. Observed: two aborted OpenRouter
        //                 attempts consumed everything left and the fast Groq
        //                 fallback behind them was skipped with -8ms to spare.
        //   400 / 404     the model name is wrong; it will still be wrong.
        // A key or billing problem is settled: stop asking this provider at all
        // for the rest of the process, not just for this call.
        if (/\b(401|402|403)\b|credits|unauthorized|invalid.*key/i.test(message)) {
          disabled.set(provider.name, message.slice(0, 80));
          break;
        }
        if (/\b(429|400|404)\b|rate limit|quota|abort/i.test(message)) break;
      }
    }
  }
  return failed(errors);
}

function failed(errors: string[]): never {
  throw new Error(`All providers failed: ${errors.join(" | ")}`);
}

/**
 * The chain's names in the order `prefer` would try them. Exported so a test
 * can assert a reordering never drops a provider - the one way `prefer` could
 * quietly turn a five-deep fallback into a single point of failure.
 */
export function providerOrder(prefer?: string[]): string[] {
  return ordered(prefer).map((p) => p.name);
}

/** A deadline `budgetMs` from now, for a caller making several completions. */
export function deadlineIn(budgetMs: number): number {
  return Date.now() + budgetMs;
}
