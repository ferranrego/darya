import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getWordCounts } from "./words.ts";

/**
 * `getWordCounts` replaced a browser-side filter over every `user_words` row,
 * so its filters must say exactly what the filters they replaced said:
 *
 *   known    status = known, lexeme_id not ux-   (curricularKnownCount)
 *   learning status = learning                   (Home's learning count)
 *   due      status = learning, due <= now       (the old useDueCount)
 *
 * A fake builder records the chain; a count query that drifted - dropping the
 * `ux-` exclusion, say - would still return a plausible number in the app and
 * never be noticed, which is why this is asserted rather than eyeballed.
 */

type Call = [string, ...unknown[]];

function fakeDb(results: number[]) {
  const chains: Call[][] = [];
  const db = {
    from(table: string) {
      const calls: Call[] = [["from", table]];
      chains.push(calls);
      const count = results[chains.length - 1];
      const builder: Record<string, unknown> = {
        then: (resolve: (v: unknown) => unknown) => resolve({ count, error: null }),
      };
      for (const m of ["select", "eq", "not", "lte"]) {
        builder[m] = (...args: unknown[]) => {
          calls.push([m, ...args]);
          return builder;
        };
      }
      return builder;
    },
  };
  return { db: db as unknown as SupabaseClient, chains };
}

describe("getWordCounts", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");

  it("returns the three counts in order", async () => {
    const { db } = fakeDb([120, 30, 7]);
    expect(await getWordCounts(db, "u1", now)).toEqual({ known: 120, learning: 30, due: 7 });
  });

  it("filters exactly like the row-based counts it replaced", async () => {
    const { db, chains } = fakeDb([0, 0, 0]);
    await getWordCounts(db, "u1", now);
    const head = { count: "exact", head: true };
    expect(chains).toEqual([
      [["from", "user_words"], ["select", "lexeme_id", head], ["eq", "user_id", "u1"], ["eq", "status", "known"], ["not", "lexeme_id", "like", "ux-%"]],
      [["from", "user_words"], ["select", "lexeme_id", head], ["eq", "user_id", "u1"], ["eq", "status", "learning"]],
      [["from", "user_words"], ["select", "lexeme_id", head], ["eq", "user_id", "u1"], ["eq", "status", "learning"], ["lte", "due", now.toISOString()]],
    ]);
  });

  it("treats a null count as zero", async () => {
    const { db } = fakeDb([undefined as unknown as number, 0, 0]);
    expect((await getWordCounts(db, "u1", now)).known).toBe(0);
  });
});
