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

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { LexiconEntry } from "../src/lib/content/schema.ts";
import { buildLexiconIndex as buildCa } from "../src/lib/lang/ca/lexicon-index.ts";
import { tokenizeCatalan } from "../src/lib/lang/ca/normalize.ts";
import { buildLexiconIndex as buildPrs } from "../src/lib/lang/prs/lexicon-index.ts";
import { tokenizeDari } from "../src/lib/lang/prs/normalize.ts";
import { contentRoot, targetLang } from "./content-path.ts";

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

interface CorpusSource {
  id: string;
  /** File name inside the corpus directory. */
  file: string;
  url: string;
  /** `hermitdave`: "word count". `leipzig`: "id\tword\tcount". */
  format: "hermitdave" | "leipzig";
  /** Inside a .tar.gz, the member to extract. */
  member?: string;
}

const SOURCES: Record<string, CorpusSource[]> = {
  ca: [
    {
      id: "subs",
      file: "ca-opensubtitles.txt",
      url: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ca/ca_full.txt",
      format: "hermitdave",
    },
    {
      id: "wiki",
      file: "ca-wikipedia.txt",
      url: "https://downloads.wortschatz-leipzig.de/corpora/cat_wikipedia_2021_300K.tar.gz",
      format: "leipzig",
      member: "cat_wikipedia_2021_300K/cat_wikipedia_2021_300K-words.txt",
    },
  ],
  prs: [
    {
      id: "subs",
      file: "fa-opensubtitles.txt",
      url: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fa/fa_full.txt",
      format: "hermitdave",
    },
    {
      id: "wiki",
      file: "fa-wikipedia.txt",
      url: "https://downloads.wortschatz-leipzig.de/corpora/pes_wikipedia_2021_300K.tar.gz",
      format: "leipzig",
      member: "pes_wikipedia_2021_300K/pes_wikipedia_2021_300K-words.txt",
    },
  ],
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

// ---------------------------------------------------------------------------
// Corpus reading
// ---------------------------------------------------------------------------

const corpusDir = join(import.meta.dirname, "data", "corpus");

async function download(source: CorpusSource): Promise<void> {
  const dest = join(corpusDir, source.file);
  mkdirSync(corpusDir, { recursive: true });

  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`${source.url}: HTTP ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());

  if (source.member) {
    // Leipzig ships a tarball; pull the one member we need through tar.
    const { execFileSync } = await import("node:child_process");
    const tmp = join(corpusDir, `${source.id}.tar.gz`);
    writeFileSync(tmp, body);
    const extracted = execFileSync("tar", ["xzf", tmp, "-O", source.member], {
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 1 << 30,
    });
    writeFileSync(dest, extracted);
    rmSync(tmp);
    return;
  }

  writeFileSync(dest, body);
}

/** Surface → corpus count, for one source. */
function readCorpus(source: CorpusSource): Map<string, number> {
  const path = join(corpusDir, source.file);
  if (!existsSync(path)) {
    throw new Error(
      `Missing corpus ${path}. Run with --download first (fetches ${source.url}).`,
    );
  }
  const out = new Map<string, number>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let surface: string;
    let count: number;
    if (source.format === "leipzig") {
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      surface = parts[1];
      count = Number(parts[2]);
    } else {
      const at = line.lastIndexOf(" ");
      if (at <= 0) continue;
      surface = line.slice(0, at);
      count = Number(line.slice(at + 1));
    }
    if (!surface || !Number.isFinite(count) || count <= 0) continue;
    // Punctuation and numerals rank very high in both formats and resolve to
    // nothing; dropping them here keeps the unresolved report readable.
    if (!/\p{L}/u.test(surface)) continue;
    out.set(surface, (out.get(surface) ?? 0) + count);
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
  const index = lang === "ca" ? buildCa(entries) : buildPrs(entries);
  const tokenizeSurface = lang === "ca" ? tokenizeCatalan : tokenizeDari;

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
  const weightSum = active.reduce((n, [, w]) => n + w, 0);

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
    const perSource: Record<string, number> = {};
    let seen = false;
    let logScore = 0;
    for (const [id, w] of active) {
      let rank: number;
      if (id === "curated") {
        rank = entry.freqRank;
      } else {
        const r = perSourceRank[id].get(entry.id);
        if (r !== undefined) seen = true;
        rank = r ?? missingRank[id];
      }
      perSource[id] = rank;
      logScore += w * Math.log(rank);
    }
    return { entry, score: Math.exp(logScore / weightSum), seen, perSource };
  });

  // Ties are broken by the curated rank, so words no corpus saw keep their
  // authored order at the tail rather than being shuffled arbitrarily.
  scored.sort((a, b) =>
    a.score !== b.score ? a.score - b.score : a.entry.freqRank - b.entry.freqRank,
  );

  const total = scored.length;
  const unseen = scored.filter((s) => !s.seen).length;

  console.log(
    `\n${lang}: ${(total - unseen).toLocaleString()} seen in at least one corpus, ` +
      `${unseen.toLocaleString()} unseen; weights ` +
      active.map(([id, w]) => `${id}=${w}`).join(" "),
  );

  // Audit artifact: small, reviewable, and the thing to read when a rank looks
  // wrong. Committed, unlike the multi-megabyte corpora it came from.
  const tsv = [
    ["rank", "band", "lexemeId", "target", "pos", "blendedScore", ...Object.keys(scored[0].perSource)].join("\t"),
    ...scored.map((s, i) =>
      [
        i + 1,
        bandForRank(i + 1, total),
        s.entry.id,
        s.entry.target,
        s.entry.pos,
        Math.round(s.score),
        ...Object.keys(scored[0].perSource).map((k) => s.perSource[k] || ""),
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

await main();
