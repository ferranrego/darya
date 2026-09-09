/**
 * Corpus sources, and reading them.
 *
 * Shared by `build-frequency.ts`, which ranks the lexicon from these, and
 * `audit-lexicon-coverage.ts`, which asks the opposite question - what the
 * corpora contain that the lexicon has no entry for. The two must agree
 * exactly about which files they read and how a line is parsed, or one of them
 * is measuring a corpus the other never saw.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface CorpusSource {
  id: string;
  /** File name inside the corpus directory. */
  file: string;
  url: string;
  /** `hermitdave`: "word count". `leipzig`: "id\tword\tcount". */
  format: "hermitdave" | "leipzig";
  /** Inside a .tar.gz, the member to extract. */
  member?: string;
}

export const SOURCES: Record<string, CorpusSource[]> = {
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

// ---------------------------------------------------------------------------
// Corpus reading
// ---------------------------------------------------------------------------

export const corpusDir = join(import.meta.dirname, "data", "corpus");

export async function download(source: CorpusSource): Promise<void> {
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
export function readCorpus(source: CorpusSource): Map<string, number> {
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
