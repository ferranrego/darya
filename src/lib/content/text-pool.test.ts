import { describe, expect, it } from "vitest";
import { selectUnread, type PoolText } from "./text-pool.ts";

/** A generated text using the given lexeme ids. */
function generated(id: string, vocabUsed: string[]): PoolText {
  return { id, source: "generated", doc: { vocabUsed } };
}

const band = Array.from({ length: 40 }, (_, i) => `lx-${String(i + 1).padStart(4, "0")}`);

describe("which texts a learner is offered", () => {
  it("accepts a text built from words the learner knows plus a few new ones", () => {
    const text = generated("t1", [...band.slice(0, 18), "lx-9001", "lx-9002"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band,
      priorIds: [],
    });
    expect(out.map((t) => t.id)).toEqual(["t1"]);
  });

  it("rejects a text that is mostly unknown", () => {
    const text = generated("t1", ["lx-9001", "lx-9002", "lx-9003", "lx-9004"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band,
      priorIds: [],
    });
    expect(out).toEqual([]);
  });

  it("rejects a text with nothing new in it", () => {
    const text = generated("t1", band.slice(0, 10));
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band,
      priorIds: [],
    });
    expect(out).toEqual([]);
  });

  it("counts the words the placement credits the learner with", () => {
    // The regression this file exists for. Being placed at A2 means the levels
    // below are already known, but only the handful of words the assessment
    // happened to show ever become rows. Measuring against the rows alone
    // rejects every text the generator wrote, the pool looks empty, and the
    // reader spins on "Writing your next text…" forever.
    // 5 rows, but the placement credits the whole band.
    const tracked = band.slice(0, 5);
    const text = generated("t1", [...band.slice(0, 18), "lx-9001", "lx-9002"]);
    const args = { texts: [text], readIds: new Set<string>(), trackedIds: tracked };

    expect(selectUnread({ ...args, priorIds: [] }), "rows only").toEqual([]);
    expect(
      selectUnread({ ...args, priorIds: band }).map((t) => t.id),
      "rows plus the placement",
    ).toEqual(["t1"]);
  });

  it("still rejects a text that is too hard for the placement", () => {
    // Crediting the prior levels must not turn into accepting anything: words
    // above the learner's level are still new.
    const text = generated("t1", ["lx-9001", "lx-9002", "lx-9003", "lx-9004"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band.slice(0, 5),
      priorIds: band,
    });
    expect(out).toEqual([]);
  });

  it("never hides a seed text, and never repeats a finished one", () => {
    const seed: PoolText = { id: "s1", source: "seed", doc: { vocabUsed: ["lx-9001"] } };
    const out = selectUnread({
      texts: [generated("t1", band.slice(0, 10)), seed],
      readIds: new Set(),
      trackedIds: [],
      priorIds: [],
    });
    expect(out.map((t) => t.id)).toEqual(["s1"]);

    const afterReading = selectUnread({
      texts: [seed],
      readIds: new Set(["s1"]),
      trackedIds: [],
      priorIds: [],
    });
    expect(afterReading).toEqual([]);
  });

  it("keeps the open text in the list so it cannot vanish mid-read", () => {
    const text = generated("t1", ["lx-9001", "lx-9002", "lx-9003", "lx-9004"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band,
      priorIds: [],
      activeTextId: "t1",
    });
    expect(out.map((t) => t.id)).toEqual(["t1"]);
  });
});
