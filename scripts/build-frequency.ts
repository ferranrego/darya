/**
 * Re-rank the lexicon from real corpus frequency.
 *
 * `freqRank` decides almost everything the reader does: which words a placement
 * credits (`placementCredit`), which band a level draws from, and which words a
 * text is allowed to teach. It was never a frequency. Ranks were the order words
 * happened to be typed into `scripts/data/*.txt`, and `redistribute-lexicon.cjs`
 * then flattened `freqBand` into ten equal buckets of 435 - so "band 1" meant
 * "the first 435 rows of the file", not "the 435 commonest words". Every level
 * threshold downstream inherited that fiction.
 *
 * This reads real corpora, resolves their surface forms onto lexemes with the
 * production morphology index, blends the sources by rank, and rewrites
 * `freqRank`/`freqBand`.
 *
 * Corpora (downloaded with --download into scripts/data/corpus/, gitignored):
 *
 *   ca   OpenSubtitles 2018 via hermitdave/FrequencyWords (CC BY-SA)
 *        Wikipedia 2021 via Leipzig Corpora Collection (CC BY-NC)
 *   prs  the same two, but for PERSIAN (fa/pes), because no Dari corpus of
 *        usable size exists. See the note on DARI_IS_PERSIAN_SOURCED below.
 *
 * The blend matters. Subtitles alone over-rank conversational particles and
 * under-rank anything written; Wikipedia alone over-ranks encyclopedic nouns and
 * barely contains a second-person verb. A learner needs both registers, so a
 * lexeme's score is the sum of its rank in each corpus and a word must do
 * reasonably well in both to rank highly.
 *
 * Usage:
 *   node scripts/build-frequency.ts --lang ca --download
 *   node scripts/build-frequency.ts --lang ca            # report only
 *   node scripts/build-frequency.ts --lang ca --apply    # rewrite the lexicon
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { PROFILES } from "../src/lib/lang/index.ts";
import { join } from "node:path";

import type { LexiconEntry } from "../src/lib/content/schema.ts";
import { contentRoot, targetLang } from "./content-path.ts";
import { SOURCES, download, readCorpus } from "./corpus.ts";

/** The profile for `lang`, or a clear error naming what is registered. */
function langProfile(lang: string) {
  const p = PROFILES[lang as keyof typeof PROFILES];
  if (!p) throw new Error(`No language profile for "${lang}" (have: ${Object.keys(PROFILES).join(", ")})`);
  return p;
}

/**
 * How much each source of evidence counts, per language. Weights are normalized,
 * so only their ratios matter.
 *
 * `curated` is the lexicon's existing `freqRank`. The two languages are in
 * opposite situations, so this is not a tuning knob - it is a statement about
 * which curation is worth anything.
 *
 * **prs leans on curation.** There is no Afghan Dari corpus at usable scale
 * (Leipzig has no `prs`, OpenSubtitles no Dari track), so the corpora here are
 * *Iranian* Persian. For the few percent of vocabulary where the two varieties
 * diverge, the corpus is not weak evidence - it is evidence about the wrong
 * language. Measured: موتر (car) ranks 3028th in Persian subtitles and 3625th in
 * Persian Wikipedia, because Iranians say ماشین; پوهنتون (university) does not
 * occur in the subtitle corpus at all. The hand-authored
 * `scripts/data/core-lexicon-*.txt` knows better - مکتب 75, موتر 83, کلان 65,
 * with Iranian بزرگ correctly demoted to 341. So curation is the spine and the
 * corpora refine it, chiefly across the 2,286 entries no corpus reached.
 *
 * **ca ignores curation entirely.** Catalan curation carries no signal: only
 * ~250 entries were hand-ordered, the rest were machine-expanded, and
 * `redistribute-lexicon.cjs` overwrote the order anyway. It ranked `català`
 * first - alphabetically plausible, frequency nonsense.
 */
const WEIGHTS: Record<string, Record<string, number>> = {
  ca: { subs: 0.5, wiki: 0.5, curated: 0 },
  prs: { subs: 0.125, wiki: 0.125, curated: 0.75 },
};

/**
 * Where each band ends, as a fraction of the lexicon.
 *
 * Bands must be graded, not equal: the first hundred words of any language do
 * most of the work in running text, and the difference between rank 40 and rank
 * 140 matters far more to a learner than the difference between 3,000 and 3,100.
 * Equal deciles - what `redistribute-lexicon.cjs` produced - flatten that away
 * and make band 1 useless as a beginner vocabulary.
 *
 * Expressed as fractions rather than absolute ranks so both lexicons populate
 * all ten bands despite being different sizes (ca 4,343, prs 6,000). At 4,343
 * this puts band 1 at the 87 commonest words and band 10 at the last ~520.
 */
const BAND_FRACTIONS = [0.02, 0.05, 0.1, 0.17, 0.27, 0.4, 0.55, 0.72, 0.88, 1.0];

function bandForRank(rank: number, total: number): number {
  for (let i = 0; i < BAND_FRACTIONS.length; i++) {
    if (rank <= Math.round(BAND_FRACTIONS[i] * total)) return i + 1;
  }
  return BAND_FRACTIONS.length;
}

/**
 * The hand-authored curated order.
 *
 * Read from `scripts/data/core-lexicon-*.txt`, NOT from the lexicon's own
 * `freqRank`, and this is the whole point. Taking `curated` from `freqRank`
 * made this script read its own previous output: each run blended the last
 * run's answer with the corpora again, so the curated signal decayed
 * geometrically and the script was not idempotent. Measured on an unchanged
 * lexicon, three consecutive runs moved موتر 915 -> 1273 -> 1637 and پوهنتون
 * 860 -> 1204 -> 1549 - the Afghan-specific words the 0.75 curated weight
 * exists to protect, sliding toward their Iranian corpus rank a third of the
 * way per run. `مکتب 75, موتر 83, کلان 65` in the header describes these
 * files; the lexicon had long since stopped saying that.
 *
 * ONLY the rank column is read. `build-lexicon.ts` warns that these files are
 * stale as *content* - later enrichment went into lexicon.json directly - and
 * that warning stands. The authored ordering is the one thing in them that
 * cannot go stale, because nothing else writes it.
 */
export function readCuratedRanks(): Map<string, number> {
  const out = new Map<string, number>();
  const dir = join(import.meta.dirname, "data");
  for (const file of readdirSync(dir).filter((f) => /^core-lexicon-\d+\.txt$/.test(f))) {
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const [rawRank, target] = line.split("|");
      const rank = Number(rawRank);
      if (!Number.isFinite(rank) || rank <= 0 || !target?.trim()) continue;
      // First writer wins: a word listed twice keeps its earliest authored rank.
      if (!out.has(target.trim())) out.set(target.trim(), rank);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Scored {
  entry: LexiconEntry;
  /** Blended rank score, lower is better. */
  score: number;
  /** Whether any corpus contained this lexeme at all. */
  seen: boolean;
  perSource: Record<string, number>;
}

async function main() {
  const lang = targetLang();
  const sources = SOURCES[lang];
  if (!sources) throw new Error(`No corpus sources configured for "${lang}"`);

  const apply = process.argv.includes("--apply");
  if (process.argv.includes("--download")) {
    for (const s of sources) {
      process.stdout.write(`downloading ${s.id}… `);
      await download(s);
      console.log("ok");
    }
  }

  const lexiconPath = join(contentRoot(), "lexicon", "lexicon.json");
  const file = JSON.parse(readFileSync(lexiconPath, "utf8"));
  const entries: LexiconEntry[] = file.entries;

  // Resolution uses the production index, so a corpus surface lands on the same
  // lexeme the reader would land on when the learner taps it. Building a
  // lemmatiser here instead would guarantee the two drift apart.
  const { buildIndex, tokenize: tokenizeSurface } = langProfile(lang).text;
  const index = buildIndex(entries);

  const perSourceRank: Record<string, Map<string, number>> = {};
  const unresolvedTop: Record<string, [string, number][]> = {};

  for (const source of sources) {
    const surfaces = readCorpus(source);
    const byLexeme = new Map<string, number>();
    const unresolved: [string, number][] = [];

    for (const [surface, count] of surfaces) {
      // Tokenize rather than resolve the raw surface. Both corpora contain
      // multi-token strings the lexicon never stores as one lexeme - Catalan
      // elisions above all (`d'un`, `l'any`, 8,000 hits each in Wikipedia), and
      // ZWNJ compounds in Persian. Resolving those raw threw the count away and
      // then reported the word as missing from the lexicon, which it is not.
      // The count belongs to each token: `d'un` occurring 8,462 times means
      // `d'` occurred 8,462 times and so did `un`.
      const tokens = tokenizeSurface(surface);
      let anyResolved = false;
      for (const token of tokens) {
        const entry = index.resolve(token);
        if (!entry) continue;
        anyResolved = true;
        byLexeme.set(entry.id, (byLexeme.get(entry.id) ?? 0) + count);
      }
      if (!anyResolved) unresolved.push([surface, count]);
    }

    const ranked = [...byLexeme.entries()].sort((a, b) => b[1] - a[1]);
    const rank = new Map<string, number>();
    ranked.forEach(([id], i) => rank.set(id, i + 1));
    perSourceRank[source.id] = rank;

    unresolved.sort((a, b) => b[1] - a[1]);
    unresolvedTop[source.id] = unresolved.slice(0, 15);

    console.log(
      `${source.id}: ${surfaces.size.toLocaleString()} surfaces → ` +
        `${ranked.length.toLocaleString()}/${entries.length.toLocaleString()} lexemes seen`,
    );
  }

  // A lexeme missing from a corpus is ranked just past everything that corpus
  // did see, rather than dropped: absence from Wikipedia is weak evidence a word
  // is rare, but absence from both is strong evidence, and summing ranks says
  // exactly that.
  const missingRank = Object.fromEntries(
    sources.map((s) => [s.id, perSourceRank[s.id].size + 1]),
  );

  const weights = WEIGHTS[lang];
  const active = Object.entries(weights).filter(([, w]) => w > 0);

  /**
   * Entries whose `freqRank` has never been independently ranked - it is a
   * fixed offset from their own id, i.e. insertion order wearing a frequency
   * column. See freq-integrity.ts. Their `curated` term is not weak evidence,
   * it is noise: at prs's curated weight of 0.75 it would anchor a word near
   * the tail regardless of what the corpora say, which is exactly how کچالو,
   * میز and آشپزخانه stayed unreachable the first time this ran. Excluded from
   * the blend for those entries only, so real corpus evidence decides them
   * instead - the same treatment a corpus gives a word it never saw.
   */
  const curatedRank = weights.curated > 0 ? readCuratedRanks() : new Map<string, number>();
  const untrustedCurated = new Set(
    entries.filter((e) => !curatedRank.has(e.target)).map((e) => e.id),
  );
  if (weights.curated > 0) {
    console.log(
      `\n${curatedRank.size} hand-authored ranks; ${untrustedCurated.size} entries have none ` +
        `- excluding their curated weight from the blend`,
    );
  }

  /**
   * Blend in log space, not rank space.
   *
   * Ranks are Zipf-distributed: the gap between rank 5 and rank 50 is a far
   * bigger difference in real frequency than the gap between 3,000 and 3,045,
   * and a plain weighted sum of ranks treats those as equal. It also lets one
   * bad source drag a word arbitrarily far down - which is precisely the Dari
   * failure above, where موتر's Iranian rank of 3,625 swamped its curated 83 at
   * any weight below about 8. A weighted geometric mean makes each source's
   * influence multiplicative, so a source can pull a word a fixed *proportion*
   * of the way rather than an unbounded number of places.
   */
  const scored: Scored[] = entries.map((entry) => {
    // Drop `curated` for an entry whose curated rank is noise, and
    // renormalize over what is left. Falls back to the full list if that
    // would leave nothing to blend from (a language with curated as its only
    // weighted source, say), since an untrustworthy signal still beats none.
    const entryActive = untrustedCurated.has(entry.id)
      ? active.filter(([id]) => id !== "curated")
      : active;
    const sources = entryActive.length > 0 ? entryActive : active;
    const entryWeightSum = sources.reduce((n, [, w]) => n + w, 0);

    const perSource: Record<string, number> = {};
    let seen = false;
    let logScore = 0;
    for (const [id, w] of sources) {
      let rank: number;
      if (id === "curated") {
        // Never `entry.freqRank`: that is this script's own previous output.
        rank = curatedRank.get(entry.target) ?? entry.freqRank;
      } else {
        const r = perSourceRank[id].get(entry.id);
        if (r !== undefined) seen = true;
        rank = r ?? missingRank[id];
      }
      perSource[id] = rank;
      logScore += w * Math.log(rank);
    }
    return { entry, score: Math.exp(logScore / entryWeightSum), seen, perSource };
  });

  // Ties are broken by the curated rank, so words no corpus saw keep their
  // authored order at the tail rather than being shuffled arbitrarily.
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    // Ties break on the authored order too, for the same reason: breaking on
    // the current freqRank would reintroduce the feedback loop at every tie.
    const ca = curatedRank.get(a.entry.target) ?? a.entry.freqRank;
    const cb = curatedRank.get(b.entry.target) ?? b.entry.freqRank;
    return ca - cb;
  });

  const total = scored.length;
  const unseen = scored.filter((s) => !s.seen).length;

  console.log(
    `\n${lang}: ${(total - unseen).toLocaleString()} seen in at least one corpus, ` +
      `${unseen.toLocaleString()} unseen; weights ` +
      active.map(([id, w]) => `${id}=${w}`).join(" "),
  );

  // Audit artifact: small, reviewable, and the thing to read when a rank looks
  // wrong. Committed, unlike the multi-megabyte corpora it came from.
  //
  // Columns come from `active`, not from one entry's `perSource` - an entry
  // whose curated term was excluded (see `untrustedCurated` above) has no
  // "curated" key, and deriving the header from such a row would silently
  // drop the column from the whole file rather than just that row.
  const sourceIds = active.map(([id]) => id);
  const tsv = [
    ["rank", "band", "lexemeId", "target", "pos", "blendedScore", ...sourceIds].join("\t"),
    ...scored.map((s, i) =>
      [
        i + 1,
        bandForRank(i + 1, total),
        s.entry.id,
        s.entry.target,
        s.entry.pos,
        Math.round(s.score),
        ...sourceIds.map((k) => s.perSource[k] ?? ""),
      ].join("\t"),
    ),
  ].join("\n");
  const tsvPath = join(import.meta.dirname, "data", `freq-${lang}.tsv`);
  writeFileSync(tsvPath, tsv + "\n");
  console.log(`wrote ${tsvPath}`);

  console.log("\ntop 30 by blended rank:");
  console.log(scored.slice(0, 30).map((s) => s.entry.target).join(", "));
  for (const s of sources) {
    console.log(`\ntop unresolved surfaces in ${s.id} (not in the lexicon at all):`);
    console.log(unresolvedTop[s.id].map(([w, c]) => `${w}(${c})`).join(" "));
  }

  if (!apply) {
    console.log("\n(dry run - pass --apply to rewrite the lexicon)");
    return;
  }

  const byId = new Map(scored.map((s, i) => [s.entry.id, i + 1]));
  file.entries = entries.map((e) => {
    const rank = byId.get(e.id)!;
    return { ...e, freqRank: rank, freqBand: bandForRank(rank, total) };
  });
  file.entries.sort((a: LexiconEntry, b: LexiconEntry) => a.freqRank - b.freqRank);
  writeFileSync(lexiconPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nrewrote ${lexiconPath}`);
}

// Only when run directly, so a test can import `readCuratedRanks` without
// rebuilding the lexicon as a side effect.
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await main();
}
