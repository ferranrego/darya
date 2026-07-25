

/**
 * The shared free-tier provider chain: an ordered list of OpenAI-compatible
 * endpoints, each tried twice before falling through to the next.
 */

interface Provider {
  name: string;
  available: () => boolean;
  call: (prompt: string, temperature: number) => Promise<string>;
}

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
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout
      
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
  openAiCompatible("openrouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "openrouter/free"),
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
        errors.push(`${provider.name}#${attempt}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  throw new Error(`All providers failed: ${errors.join(" | ")}`);
}
