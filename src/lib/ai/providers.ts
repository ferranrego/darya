

/**
 * The shared free-tier provider chain: an ordered list of OpenAI-compatible
 * endpoints, each tried twice before falling through to the next.
 */

interface Provider {
  name: string;
  available: () => boolean;
  call: (prompt: string, temperature: number, timeoutMs: number) => Promise<string>;
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

function openAiCompatible(
  name: string,
  baseUrl: string,
  keyEnv: string,
  modelEnv: string,
  defaultModel: string,
): Provider {
  return {
    name,
    available: () => !!process.env[keyEnv],
    async call(prompt, temperature, timeoutMs) {
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
 */
const providers: Provider[] = [
  openAiCompatible("huggingface", "https://router.huggingface.co/v1", "HUGGINGFACE_API_KEY", "HUGGINGFACE_MODEL", "Qwen/Qwen2.5-72B-Instruct"),
  openAiCompatible("groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL", "llama-3.3-70b-versatile"),
  openAiCompatible("openrouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "openrouter/free"),
  openAiCompatible("groq-fallback", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL_FALLBACK", "llama-3.1-8b-instant"),
  openAiCompatible("huggingface-fallback", "https://router.huggingface.co/v1", "HUGGINGFACE_API_KEY", "HUGGINGFACE_MODEL_FALLBACK", "Qwen/Qwen3-32B"),
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
}

/**
 * Ask the chain for one JSON completion. The prompt must contain the word
 * "JSON" - providers require it alongside `response_format: json_object`.
 */
export async function completeJson<T>(prompt: string, opts: CompleteOptions<T>): Promise<T> {
  const errors: string[] = [];
  const deadline = opts.deadline ?? Date.now() + DEFAULT_BUDGET_MS;

  for (const provider of providers) {
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
        );
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

/** A deadline `budgetMs` from now, for a caller making several completions. */
export function deadlineIn(budgetMs: number): number {
  return Date.now() + budgetMs;
}
