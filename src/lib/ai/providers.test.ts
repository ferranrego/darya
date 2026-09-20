import { describe, expect, it } from "vitest";
import { providerOrder, stripReasoning } from "./providers.ts";

/**
 * Every provider in the chain is configured to keep its reasoning out of
 * `content`, so in principle none of this runs. It exists because one slot -
 * `openrouter/free` - is an auto-router whose actual model changes without this
 * repo changing, and because a model swap is exactly the sort of edit that
 * looks harmless. The cost of being wrong is two paid attempts and a parse
 * error that names nothing.
 */
describe("stripReasoning", () => {
  it("leaves an ordinary JSON answer untouched", () => {
    const json = '{"text":"سلام"}';
    expect(stripReasoning(json)).toBe(json);
  });

  it("drops a think block and returns the JSON after it", () => {
    expect(stripReasoning('<think>The learner asked for a greeting.</think>{"text":"سلام"}')).toBe(
      '{"text":"سلام"}',
    );
  });

  it("handles the reasoning tag spelled <reasoning>", () => {
    expect(stripReasoning('<reasoning>step one</reasoning>\n{"a":1}')).toBe('{"a":1}');
  });

  it("tolerates leading whitespace before the tag", () => {
    expect(stripReasoning('\n  <think>hmm</think>{"a":1}')).toBe('{"a":1}');
  });

  it("keeps a think tag that appears inside the content, not as a preamble", () => {
    // A text about the word "think" is content, not reasoning. Only a preamble
    // is a reasoning block, which is why the check is anchored to the start.
    const json = '{"text":"<think> is an English word"}';
    expect(stripReasoning(json)).toBe(json);
  });

  it("returns empty for a truncated thought, so validation fails at once", () => {
    // No closing tag means the response was cut off mid-reasoning and no JSON
    // is coming. Returning the thought itself would fail later and less clearly.
    expect(stripReasoning("<think>I should start by")).toBe("");
  });

  it("does not swallow a multi-line thought's closing tag", () => {
    const raw = '<think>\nline one\nline two\n</think>\n\n{"ok":true}';
    expect(stripReasoning(raw)).toBe('{"ok":true}');
  });
});

/**
 * `prefer` reorders; it must never filter. A caller preferring one provider
 * that happens to be down would otherwise be left with no chain at all.
 */
describe("providerOrder", () => {
  it("keeps every provider when preferring one", () => {
    expect(providerOrder(["groq"]).length).toBe(providerOrder().length);
  });

  it("puts the preferred provider first", () => {
    expect(providerOrder(["groq-fallback"])[0]).toBe("groq-fallback");
  });
});
