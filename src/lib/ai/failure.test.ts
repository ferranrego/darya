import { describe, expect, it } from "vitest";
import { classifyAiFailure, messageOf } from "./failure.ts";
import { glossFailure, translationFailure } from "./import-failure.ts";

/**
 * The strings below are real shapes `completeJson` produces. It concatenates
 * every attempt's error into one message, so classification is pattern-matching
 * on that - and the patterns are the only thing standing between a learner and
 * "try again in a moment" for a failure that retrying cannot fix.
 */
describe("classifyAiFailure", () => {
  it("recognises quota and rate limits", () => {
    expect(classifyAiFailure(new Error("All providers failed: groq#0: groq 429: rate limit"))).toBe("busy");
    expect(classifyAiFailure(new Error("openrouter 402: out of credits"))).toBe("busy");
    expect(classifyAiFailure(new Error("huggingface: monthly quota exceeded"))).toBe("busy");
  });

  it("recognises running out of time", () => {
    expect(classifyAiFailure(new Error("The operation was aborted"))).toBe("slow");
    expect(classifyAiFailure(new Error("timed out after 25000ms"))).toBe("slow");
    expect(classifyAiFailure(new Error("only 900ms left"))).toBe("slow");
  });

  // An aborted attempt often also carries an earlier provider's 429 in the same
  // message. "Slow" is the more actionable of the two, so it must win.
  it("prefers slow over busy when a message carries both", () => {
    expect(
      classifyAiFailure(new Error("All providers failed: groq#0: 429 rate limit; groq#1: aborted")),
    ).toBe("slow");
  });

  /**
   * The case the generic message was actively wrong about: every provider
   * answered, and every answer failed validation. Retrying does the same thing.
   */
  it("recognises output that keeps failing validation", () => {
    expect(
      classifyAiFailure(
        new Error(
          "All providers failed: huggingface#0: Translation returned 3 of 5 sentences; " +
            "groq#0: Translation returned index 2 twice",
        ),
      ),
    ).toBe("invalid");
  });

  /**
   * "invalid" is the only reason that tells the learner retrying is pointless,
   * so a transport error must never be classified as one - the models never
   * actually answered, and the next attempt may well work.
   */
  it("does not call a transport error invalid", () => {
    expect(
      classifyAiFailure(new Error("All providers failed: groq#0: groq 503: service unavailable")),
    ).toBe("failed");
    expect(
      classifyAiFailure(new Error("All providers failed: groq#0: groq 500: internal error")),
    ).not.toBe("invalid");
  });

  it("falls back to failed", () => {
    expect(classifyAiFailure(new Error("something else entirely"))).toBe("failed");
  });

  // A Postgres trigger's exception arrives as a plain object, not an Error, and
  // stringifies to "[object Object]" - which used to classify as generic.
  it("reads a message off a non-Error object", () => {
    expect(messageOf({ message: "tutor_rate_limit exceeded" })).toContain("tutor_rate_limit");
    expect(classifyAiFailure({ message: "tutor_rate_limit exceeded" })).toBe("limit");
  });
});

describe("import failure copy", () => {
  it("gives every reason its own wording and status", () => {
    const cases = [
      new Error("groq 429: rate limit"),
      new Error("aborted"),
      new Error("All providers failed: bad shape; bad shape"),
      new Error("mystery"),
    ];
    const seen = new Set<string>();
    for (const e of cases) {
      const f = translationFailure(e);
      expect(f.message.length).toBeGreaterThan(10);
      seen.add(f.message);
      // Provider names, models and status codes must never reach a learner.
      expect(f.message).not.toMatch(/groq|openrouter|huggingface|qwen|llama|\b\d{3}\b/i);
    }
    expect(seen.size).toBe(cases.length);
  });

  it("says different things about a sentence and a word", () => {
    const e = new Error("groq 429: rate limit");
    expect(translationFailure(e).message).not.toBe(glossFailure(e).message);
    expect(translationFailure(e).status).toBe(glossFailure(e).status);
  });

  it("does not tell the learner to retry something retrying cannot fix", () => {
    const invalid = new Error("All providers failed: bad shape; bad shape");
    expect(translationFailure(invalid).reason).toBe("invalid");
    expect(translationFailure(invalid).message).not.toMatch(/try again|again/i);
    expect(glossFailure(invalid).message).not.toMatch(/try again/i);
  });
});
