/**
 * What the corpora contain that the lexicon has no entry for.
 *
 * `build-frequency.ts` asks how common each lexicon entry is. This asks the
 * opposite, and nothing did until an imported news article turned out to
 * resolve at 69.5% of its tokens against a lexicon that has "Universal
 * Declaration of Human Rights" but not "family". A gap that size is invisible
 * to every existing check: `validate-content.ts` verifies what is there, and
 * `freq-integrity.ts` verifies the ranks of what is there. Neither can see an
 * absence.
 *
 * Both scripts read the corpora through `corpus.ts` so they cannot disagree
 * about what a corpus says.
 *
 * ## Reading the output
 *
 * A high-frequency surface the lexicon cannot resolve is one of four things,
 * and only the last is a word to author:
 *
 *   1. an inflected or compound form of a word that IS in the lexicon - a
 *      morphology gap, not a vocabulary gap, and a more urgent bug because it
 *      makes an entry the learner already has fail to resolve when they meet it;
 *   2. a proper noun, which does not belong in a lexicon at all;
 *   3. a colloquial form the app deliberately refuses to teach - for `prs` the
 *      subtitle corpus is Iranian Persian, and یه/خب/اگه are exactly the
 *      interference CLAUDE.md warns about;
 *   4. ordinary vocabulary that is simply missing.
 *
 * The script separates 1 mechanically and gives 2 and 3 the best signal
 * available, which is presence in BOTH corpora: a colloquial subtitle form is
 * rare in an encyclopedia, and an encyclopedic proper noun is rare in dialogue.
 * It does not pretend to settle them - the ranked file is a candidate list for
 * a philologist, not a to-do list. See CLAUDE.md on authoring vocabulary.
 *
 * Usage:
 *   node scripts/audit-lexicon-coverage.ts --lang prs
 *   node scripts/audit-lexicon-coverage.ts --lang prs --top 400 --write
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import type { LexiconEntry } from "../src/lib/content/schema.ts";
import { buildLexiconIndex as buildCa } from "../src/lib/lang/ca/lexicon-index.ts";
import { tokenizeCatalan } from "../src/lib/lang/ca/normalize.ts";
import { buildLexiconIndex as buildPrs } from "../src/lib/lang/prs/lexicon-index.ts";
import { tokenizeDari, ZWNJ } from "../src/lib/lang/prs/normalize.ts";
import { contentRoot, targetLang } from "./content-path.ts";
import { SOURCES, readCorpus } from "./corpus.ts";

interface Candidate {
  surface: string;
  /** Occurrences per corpus id. */
  counts: Record<string, number>;
  /** Rank within the unresolved surfaces of each corpus. */
  ranks: Record<string, number>;
  /**
   * The worse of its two corpus ranks. Sorting on this demands a word do
   * reasonably well in BOTH registers, which is what separates ordinary
   * vocabulary from a subtitle colloquialism or an encyclopedia's proper nouns.
   */
  worstRank: number;
  /** A form of something already in the lexicon: a morphology gap. */
  morphology: boolean;
}

function flag(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const lang = targetLang();
  const sources = SOURCES[lang];
  if (!sources) throw new Error(`No corpus sources configured for "${lang}"`);
  const top = Number(flag("--top", "300"));
  const write = process.argv.includes("--write");

  const lexiconPath = join(contentRoot(), "lexicon", "lexicon.json");
  const entries: LexiconEntry[] = JSON.parse(readFileSync(lexiconPath, "utf8")).entries;
  // The production index, so "unresolved here" means "unresolved when a learner
  // taps it". A lemmatiser written for this script would drift from the reader.
  const index = lang === "ca" ? buildCa(entries) : buildPrs(entries);
  const tokenize = lang === "ca" ? tokenizeCatalan : tokenizeDari;

  /**
   * Is this a form of something the lexicon already has?
   *
   * Deliberately crude and language-neutral: split on the joiners that glue
   * clitics onto a word, and see whether the pieces resolve. It only has to be
   * good enough to keep morphology gaps out of the vocabulary list and into
   * their own, where they are a different and more urgent bug.
   */
  function isMorphology(surface: string): boolean {
    const parts = surface.split(new RegExp(`[${ZWNJ}'’‐-]`)).filter(Boolean);
    if (parts.length < 2) return false;
    return parts.every((p) => index.resolve(p) !== null);
  }

  const candidates = new Map<string, Candidate>();
  const totals: Record<string, { resolved: number; total: number }> = {};

  for (const source of sources) {
    const surfaces = readCorpus(source);
    const unresolved: [string, number][] = [];
    let resolvedTokens = 0;
    let totalTokens = 0;

    for (const [surface, count] of surfaces) {
      // Same tokenization as the ranker: a corpus "surface" can be several
      // tokens, and the count belongs to each of them.
      for (const token of tokenize(surface)) {
        totalTokens += count;
        if (index.resolve(token)) resolvedTokens += count;
        else unresolved.push([token, count]);
      }
    }
    totals[source.id] = { resolved: resolvedTokens, total: totalTokens };

    // Collapse repeated tokens before ranking.
    const merged = new Map<string, number>();
    for (const [t, c] of unresolved) merged.set(t, (merged.get(t) ?? 0) + c);
    const ranked = [...merged.entries()].sort((a, b) => b[1] - a[1]);

    ranked.forEach(([surface, count], i) => {
      let c = candidates.get(surface);
      if (!c) {
        c = { surface, counts: {}, ranks: {}, worstRank: 0, morphology: isMorphology(surface) };
        candidates.set(surface, c);
      }
      c.counts[source.id] = count;
      c.ranks[source.id] = i + 1;
    });

    console.log(
      `${source.id}: ${surfaces.size.toLocaleString()} surfaces, ` +
        `${((resolvedTokens / totalTokens) * 100).toFixed(1)}% of running tokens resolve, ` +
        `${merged.size.toLocaleString()} distinct unresolved types`,
    );
  }

  // A surface absent from a corpus is ranked just past everything that corpus
  // saw, so "missing from one entirely" is a heavy penalty rather than a free
  // pass - which is the whole point of requiring both registers.
  const absent: Record<string, number> = {};
  for (const s of sources) {
    // A fold, not Math.max(...spread): there are hundreds of thousands of
    // candidates and spreading them overflows the call stack.
    let worst = 0;
    for (const c of candidates.values()) {
      const r = c.ranks[s.id] ?? 0;
      if (r > worst) worst = r;
    }
    absent[s.id] = worst + 1;
  }
  for (const c of candidates.values()) {
    let worst = 0;
    for (const s of sources) {
      const r = c.ranks[s.id] ?? absent[s.id];
      if (r > worst) worst = r;
    }
    c.worstRank = worst;
  }

  const all = [...candidates.values()].sort((a, b) => a.worstRank - b.worstRank);
  const morphology = all.filter((c) => c.morphology);
  const vocabulary = all.filter((c) => !c.morphology);

  console.log(`\n${all.length.toLocaleString()} distinct unresolved surfaces in total`);
  console.log(`  ${morphology.length.toLocaleString()} are forms of words already in the lexicon (morphology gaps)`);
  console.log(`  ${vocabulary.length.toLocaleString()} are not`);

  /**
   * How many candidates sit in each frequency tier.
   *
   * The tiers are the shape of `BAND_FRACTIONS` in build-frequency.ts rather
   * than its exact cut points, because a missing word has no lexicon rank to
   * band - what matters is the order of magnitude. A candidate in the first
   * hundred is a word the learner meets constantly; one at 3,000 is not the
   * same problem.
   */
  console.log("\nvocabulary candidates by frequency tier (worst-corpus rank):");
  let previous = 0;
  for (const tier of [100, 250, 500, 1000, 2000, 5000]) {
    const n = vocabulary.filter((c) => c.worstRank > previous && c.worstRank <= tier).length;
    console.log(`  ${String(previous + 1).padStart(5)}-${String(tier).padEnd(5)} ${n}`);
    previous = tier;
  }
  console.log(`  beyond ${previous}: ${vocabulary.filter((c) => c.worstRank > previous).length}`);

  console.log(`\ntop ${Math.min(top, vocabulary.length)} vocabulary candidates, ranked by worst-corpus rank:`);
  console.log(
    vocabulary
      .slice(0, 60)
      .map((c) => `${c.surface}(${sources.map((s) => c.ranks[s.id] ?? "-").join("/")})`)
      .join("  "),
  );

  console.log(`\ntop morphology gaps - already in the lexicon but not resolving:`);
  console.log(morphology.slice(0, 30).map((c) => c.surface).join("  "));

  if (!write) {
    console.log("\n(pass --write to save the ranked candidate file)");
    return;
  }

  const header = ["surface", ...sources.map((s) => `${s.id}_rank`), ...sources.map((s) => `${s.id}_count`), "worst_rank"];
  const rows = vocabulary
    .slice(0, top)
    .map((c) =>
      [
        c.surface,
        ...sources.map((s) => c.ranks[s.id] ?? ""),
        ...sources.map((s) => c.counts[s.id] ?? 0),
        c.worstRank,
      ].join("\t"),
    );
  const out = join(import.meta.dirname, "data", `coverage-gap-${lang}.tsv`);
  writeFileSync(out, [header.join("\t"), ...rows].join("\n") + "\n");
  console.log(`\nwrote ${out} (${rows.length} candidates)`);
}

await main();
