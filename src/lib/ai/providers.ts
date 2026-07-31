

/**
 * The shared free-tier provider chain: an ordered list of OpenAI-compatible
 * endpoints, each tried twice before falling through to the next.
 */

interface Provider {
  name: string;
  available: () => boolean;
  call: (prompt: string, temperature: number) => Promise<string>;
}

/**
 * Per-provider request timeout.
 *
 * A single 20s budget for the whole chain meant the fallback could never
 * actually take over. Groq answers in a couple of seconds, so 20s is generous
 * there; OpenRouter's free tier *queues* requests and routinely takes longer
 * than that, so every failover ended in "This operation was aborted" - observed
 * on both attempts the day Groq's daily token limit ran out, which is precisely
 * the day the fallback was supposed to earn its place.
 *
 * The route allows 60s (`maxDuration`), so the slower budget still fits.
 */
const TIMEOUT_MS: Record<string, number> = { groq: 20_000, "groq-fallback": 20_000, openrouter: 45_000, huggingface: 45_000 };
const DEFAULT_TIMEOUT_MS = 20_000;

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
    async call(prompt, temperature) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        TIMEOUT_MS[name] ?? DEFAULT_TIMEOUT_MS,
      );
      
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

const providers: Provider[] = [
  openAiCompatible("groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL", "llama-3.3-70b-versatile"),
  openAiCompatible("huggingface", "https://router.huggingface.co/v1", "HUGGINGFACE_API_KEY", "HUGGINGFACE_MODEL", "Qwen/Qwen2.5-72B-Instruct"),
  openAiCompatible("openrouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "openrouter/free"),
  openAiCompatible("groq-fallback", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL_FALLBACK", "llama-3.1-8b-instant"),
];

interface CompleteOptions<T> {
  temperature?: number;
  /** Parse and check one raw response. Throwing rejects that attempt. */
  validate: (raw: string, providerName: string) => T;
}

/**
 * Ask the chain for one JSON completion. The prompt must contain the word
 * "JSON" - providers require it alongside `response_format: json_object`.
 */
export async function completeJson<T>(prompt: string, opts: CompleteOptions<T>): Promise<T> {
  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.available()) continue;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let raw = await provider.call(prompt, opts.temperature ?? 0.8);
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
        // A rate limit is the one failure a second identical request cannot
        // fix, and on a daily quota it is not going to clear this minute
        // either. Retrying spends another request against the same limit, so
        // hand over to the next provider immediately - which is the situation
        // the chain exists for.
        if (/\b429\b|rate limit|quota/i.test(message)) break;
      }
    }
  }
  throw new Error(`All providers failed: ${errors.join(" | ")}`);
}
