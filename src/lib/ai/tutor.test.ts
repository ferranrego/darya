import { describe, expect, it } from "vitest";

import { profile } from "../lang/index.ts";
import { providerOrder } from "./providers.ts";
import { buildTutorPrompt, tutorErrorReason, type TutorTurn } from "./tutor.ts";

/**
 * The conversation partner's two invariants, neither of which is observable
 * without spending a provider call to find out:
 *
 *  - the prompt is bounded and carries no vocabulary list. This is the cost
 *    ceiling. The reader's known-word slice going 160 -> 600 exhausted a day's
 *    quota for every learner on the deployment in one session, and a chat
 *    prompt is rebuilt on *every* turn, so the same mistake here is worse.
 *  - nothing the provider chain says reaches the learner. Its failure message
 *    names providers, model ids and fragments of upstream response bodies, and
 *    it was returned verbatim to the client by /api/chat/enrich in production.
 */

function turns(n: number): TutorTurn[] {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? ("user" as const) : ("tutor" as const),
    body: `turn-${i}`,
  }));
}

describe("buildTutorPrompt", () => {
  it("keeps only the last 10 turns however long the conversation gets", () => {
    const prompt = buildTutorPrompt(turns(40), "B1");

    expect(prompt).toContain("turn-39");
    expect(prompt).toContain("turn-30");
    expect(prompt).not.toContain("turn-29");
    expect(prompt).not.toContain("turn-0:");
  });

  it("does not grow once the history is longer than the window", () => {
    const at10 = buildTutorPrompt(turns(10), "B1").length;
    const at200 = buildTutorPrompt(turns(200), "B1").length;

    // Same number of turns rendered, so any growth is a leak. The bodies are
    // wider at 200 ("turn-199" vs "turn-9"), hence a small tolerance.
    expect(at200 - at10).toBeLessThan(40);
  });

  it("carries the learner's CEFR level", () => {
    expect(buildTutorPrompt([], "A2")).toContain("A2");
    expect(buildTutorPrompt([], "C1")).toContain("C1");
  });

  it("contains the literal word JSON, which the providers require", () => {
    // `response_format: json_object` is rejected without it - a 400 the chain
    // recovers from silently, after paying for every provider in turn.
    expect(buildTutorPrompt(turns(4), "B1")).toContain("JSON");
  });

  it("sends no vocabulary list", () => {
    const prompt = buildTutorPrompt(turns(10), "B2");

    // A word list is the failure mode: it would arrive as dozens of
    // comma-separated target-language tokens on one line.
    const longest = prompt
      .split("\n")
      .reduce((n, line) => Math.max(n, line.split(",").length), 0);
    expect(longest).toBeLessThan(8);
    expect(prompt.length).toBeLessThan(2500);
  });

  it("handles an empty thread without inventing a transcript", () => {
    const prompt = buildTutorPrompt([], "A1");
    expect(prompt).toContain("Greet them");
    expect(prompt).not.toContain("Learner:");
  });
});

describe("tutorErrorReason", () => {
  const PROVIDERS = ["groq", "openrouter", "huggingface", "Qwen", "llama"];

  it("reads a spent quota as busy", () => {
    const raw = new Error(
      'All providers failed: huggingface#0: huggingface 402: {"error":"You have exceeded your monthly included credits"} | groq#0: groq 429: rate limit reached',
    );
    expect(tutorErrorReason(raw).reason).toBe("busy");
    expect(tutorErrorReason(raw).status).toBe(503);
  });

  it("reads a chain that ran out of time as slow", () => {
    const raw = new Error(
      "All providers failed: openrouter#0: This operation was aborted | groq-fallback#0: skipped, 812ms left",
    );
    expect(tutorErrorReason(raw).reason).toBe("slow");
  });

  it("reads the insert trigger's rate limit as limit", () => {
    expect(tutorErrorReason({ message: "tutor_rate_limit_day" }).reason).toBe("limit");
    expect(tutorErrorReason(new Error("tutor_rate_limit_minute")).status).toBe(429);
  });

  it("falls back to a generic failure", () => {
    expect(tutorErrorReason(new Error("Unexpected token < in JSON")).reason).toBe("failed");
    expect(tutorErrorReason(null).reason).toBe("failed");
  });

  it("never names a provider, model or status code in what the learner sees", () => {
    const raws = [
      'All providers failed: groq#0: groq 429: {"error":{"message":"Rate limit reached for model `llama-3.3-70b-versatile`"}}',
      "All providers failed: huggingface#1: Qwen/Qwen2.5-72B-Instruct is not supported by any provider you have enabled",
      "All providers failed: openrouter#0: This operation was aborted",
      "tutor_rate_limit_day",
      "something else entirely",
    ];

    for (const raw of raws) {
      const { message } = tutorErrorReason(new Error(raw));
      for (const name of PROVIDERS) {
        expect(message.toLowerCase()).not.toContain(name.toLowerCase());
      }
      expect(message).not.toMatch(/\b(4\d\d|5\d\d)\b/);
      expect(message).not.toContain("tutor_rate_limit");
      // It has to be readable, not just scrubbed.
      expect(message.length).toBeGreaterThan(20);
    }
  });

  it("names the mascot, so the copy survives a rebrand", () => {
    expect(tutorErrorReason(new Error("429")).message).toContain(profile.brand.mascotName);
  });
});

describe("providerOrder", () => {
  it("reorders without dropping a fallback", () => {
    const base = providerOrder();
    const preferred = providerOrder(["groq"]);

    expect(preferred[0]).toBe("groq");
    // The whole point of `prefer` being a sort and not a filter: preferring one
    // provider must not leave a caller with a chain one deep when it fails.
    expect([...preferred].sort()).toEqual([...base].sort());
  });

  it("keeps the default relative order among unpreferred providers", () => {
    const base = providerOrder().filter((n) => n !== "huggingface");
    expect(providerOrder(["huggingface"]).slice(1)).toEqual(base);
  });

  it("is a no-op for an unknown name", () => {
    expect(providerOrder(["nope"])).toEqual(providerOrder());
  });
});
