/**
 * Apply the app's Dari spelling convention to every Latin transliteration.
 *
 * Three decisions, made by the owner on the philologist's advice and final:
 *
 *  1. **The short kasra is `i`, not `e`.** Dari has three short vowels, a / i
 *     / u: `kitāb`, `bisyār`, `zindagī`, `mu'allim`, `imrōz`. Majhul `ē` is a
 *     different vowel and never changes (`dōst`, `nēst`, `sē`, `mē-`), and the
 *     ezafe stays `-e` / `-ye` - it is a marker, not a vowel of the word, and
 *     `bareEzafeAfterVowel` already enforces its shape.
 *  2. **چه is `chi`** (`chirā`, `chitōr`). The spoken چی stays `chī`.
 *  3. **The 1pl verb ending is majhul `-ēm`**, not `-īm`: `mērawēm`,
 *     `hastēm`. Only on verbs: `taqsīm`, `ta'līm` and `qadīm` are nouns.
 *
 * The content was authored by hand and by bulk passes over several years, so
 * the lexicon alone carried ~1,100 distinct words with an Iranian `e` and the
 * course taught `shāgerd` in its tables while the Grammar Hub said `kitāb` was
 * still to come. A learner has no audio, so the Latin line is the only
 * pronunciation they get - and it disagreed with itself.
 *
 * Why this is not a regex over the files. An `e` in the transliteration is
 * three different things, and only one of them is a kasra:
 *
 *  - the kasra (`ketāb` → `kitāb`) - the rule;
 *  - a majhul ē whose macron was lost (`mekonad` for می‌کند, `pesh` for پیش).
 *    Turning that into `i` would teach the Iranian `mikonad` - the defect
 *    PEDAGOGY §9 cares most about. The Dari script is what tells them apart:
 *    ی is written for a long vowel and never for a kasra, so a ی the Latin
 *    does not account for means the `e` was a flattened `ē`;
 *  - a final ه the Iranian convention writes `-e` (`saze` for سازه) where the
 *    app writes `-a` (`khāna`).
 *
 * So every structured transliteration is aligned word by word with its own
 * Dari line and each word is decided with that evidence. Words whose evidence
 * is contradictory are left unchanged and reported, never guessed at.
 *
 * Where there is no Dari (course table cells, hub pattern rows, search
 * aliases, level descriptions, English prose), a word is only rewritten to a
 * spelling the script already chose for it with evidence:
 *
 *  - English prose: a word that changed in a structured field of the *same*
 *    lesson or hub page, never a word in `ENGLISH_WORDS`; beyond that only a
 *    word carrying a macron (so it cannot be English), decided by the corpus
 *    or, failing that, by the script-free rules. `che` becomes `chi` and a
 *    quoted ending (`-emān`) takes the i rule;
 *  - Latin-only cells: the same, and a macron-less word the corpus decided;
 *  - hub search aliases gain the new spelling and keep the old one, so a
 *    search for "ketab" still finds the page.
 *
 * Idempotent: a second run over its own output changes nothing, and it is
 * meant to be re-run after any content merge.
 *
 *   node scripts/normalise-dari-spelling.ts --dry        # report only (default)
 *   node scripts/normalise-dari-spelling.ts --apply
 *   node scripts/normalise-dari-spelling.ts --dry --samples 200
 *
 * The rule the sweep applies is enforced afterwards by `shortEVowel`,
 * `cheAsWord` and `verb1plIm` in `src/lib/lang/prs/translit-check.ts`, run
 * by `pnpm validate:content`. Code in `src/lib/lang/prs/` is not rewritten
 * here; `--scan-code` lists the words it would change there for a human edit.
 */
import { readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  LATIN_WORD,
  isEzafeSegment,
  isShortEException,
  isVerb1plStem,
  shortEVowels,
  cheAsWord,
  verb1plIm,
} from "../src/lib/lang/prs/translit-check.ts";

// --- rules --------------------------------------------------------------------

export type Rule =
  | "short-i"
  | "chi"
  | "1pl-ēm"
  | "mē-prefix"
  | "bu-prefix"
  | "majhul-ē"
  | "final-a"
  | "override";

/**
 * Words the rules cannot get right, repaired by hand after reading them. Each
 * is an Iranian vowel where Dari has a different one entirely, so `e` → `i`
 * would only swap one wrong vowel for another: جناب is `janāb`, نوشتن is
 * `nawishtan`, چشمه is `chashma` (the lexicon's own example already says so).
 * Applied to the whole lower-cased word before any rule.
 */
export const OVERRIDES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^jenāb/u, "janāb"],
  [/(^|-)(na|bu|bi|be|mē|me)?newe(sh|š)t/u, "$1$2nawi$3t"],
  [/(^|-)(na|bu|bi|be|mē|me)?newīs/u, "$1$2nawīs"],
  [/(^|-)sarnawesht/u, "$1sarnawisht"],
  [/(^|-)sar-nevesht/u, "$1sar-nawisht"],
  [/^cheshma/u, "chashma"],
  [/^kheyr$/u, "khayr"],
  [/^barāye$/u, "barā-ye"],
  [/^zereh$/u, "zirih"],
  [/^shaheed$/u, "shahīd"],
  [/^aseer$/u, "asīr"],
  [/^modafe$/u, "mudāfi'"],
  [/^mawze$/u, "mawzi'"],
  [/^larze-/u, "larza-"],
  [/^kelken$/u, "kilkīn"],
  [/^sheshom$/u, "shashum"],
  [/^jegran$/u, "jagran"],
  [/^aljebr$/u, "aljabr"],
  // the parked L3 drafts: flattened throughout, three 1pl verbs repaired by hand
  [/^m[eē]neshinem$/u, "mēnishīnēm"],
  [/^barmegardem$/u, "barmēgardēm"],
  [/^m[eē]newisem$/u, "mēnawīsēm"],
];

/** Common English words the prose pass must never touch, whatever the maps say. */
export const ENGLISH_WORDS: ReadonlySet<string> = new Set(
  (
    "a an the be been me he she we ye her hen men ten den pen hem set sent send see seen " +
    "the then them these there here were where when whet deh del bed beg bet get jet let " +
    "led net met pet peg set vet wet yet yes eg ie etc de le se ne mesh mere merit " +
    "sheer shed shell sher ever even event never seven eleven key keys model modern hotel " +
    "test web internet general metro opera cricket " +
    // the grammar term, written as English in the course and hub prose
    "ezāfa ezafe"
  ).split(" "),
);

/** Endings quoted after a hyphen in prose and tables. */
const SUFFIX_QUOTES: ReadonlyMap<string, string> = new Map([
  ["emān", "imān"], ["etān", "itān"], ["eshān", "ishān"], ["et", "it"], ["esh", "ish"],
]);

export interface Ctx {
  /** i-normalised present stems (Latin) keyed to their Dari spelling. */
  presentStems: ReadonlyArray<{ latin: string; dari: string }>;
  isVerbStem: (latin: string) => boolean;
  /** Every Dari form listed on a verb entry, and every non-verb headword. */
  verbForms?: ReadonlySet<string>;
  nonVerbTargets?: ReadonlySet<string>;
}

export interface TokenResult {
  out: string;
  rules: Rule[];
  skip?: string;
}

const DARI_STRIP = /[‌‍ـً-ٰٟٔ]/g;
export function normDari(w: string): string {
  return w.replace(DARI_STRIP, "").replace(/ي/g, "ی").replace(/ك/g, "ک");
}

/** Dari words, with a detached می/نمی joined back to its verb. */
export function dariWords(script: string): string[] {
  const raw = script
    .split(/[\s.,،؛؟?!:;()«»"\/…]+/u)
    .map(normDari)
    .filter((w) => /[؀-ۿ]/.test(w));
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if ((raw[i] === "می" || raw[i] === "نمی") && i + 1 < raw.length) {
      out.push(raw[i] + raw[++i]);
    } else out.push(raw[i]);
  }
  return out;
}

const i = (s: string) => s.replace(/e/g, "i");
const yehCount = (d: string) => (d.match(/[یېۍ]/g) ?? []).length;
/**
 * Latin letters that can stand for a written ی. A bare `i` counts: the lexicon
 * often writes the -ī suffix short (`tejāri` for تجاری), and that ی is spoken
 * for, so it must not make the `e` look like a flattened ē.
 */
const latinYCount = (w: string) => (w.match(/[īēy]|i(?!̄)/g) ?? []).length;

/**
 * Decide one Latin word. `dari` is its aligned Dari word when the pair aligned,
 * undefined when there is no evidence at all.
 */
export function normaliseToken(token: string, dari: string | undefined, ctx: Ctx): TokenResult {
  const same: TokenResult = { out: token, rules: [] };
  const nfc = token.normalize("NFC");
  if (nfc.length < 2) return same;
  if (/\p{Lu}/u.test(nfc.slice(1))) return same; // initialisms, CamelCase
  const cap = /^\p{Lu}/u.test(nfc);
  let w = nfc.toLowerCase();
  const rules = new Set<Rule>();
  const D = dari === undefined ? undefined : normDari(dari);

  for (const [re, rep] of OVERRIDES) {
    if (re.test(w)) {
      w = w.replace(re, rep);
      rules.add("override");
    }
  }

  // How many written ی the Latin does not account for. Each is a long vowel
  // the Latin flattened; a flattened ē must not become i.
  let unaccountedYeh = D === undefined ? 0 : yehCount(D) - latinYCount(w);

  const segs = w.split("-");
  let skip: string | undefined;
  for (let k = 0; k < segs.length; k++) {
    let s = segs[k];
    if (isEzafeSegment(s, k)) continue;
    if (!/e|[iī]m$/u.test(s)) continue;
    if (isShortEException(s)) continue;

    // 2. چه is chi, in its compounds too; spoken چی is chī.
    if (/^(ag|g)?arche$/u.test(s)) {
      s = s.slice(0, -1) + "i";
      rules.add("chi");
    } else if (s === "che" || /^che(rā|tōr|ṭōr|gūna)$/u.test(s)) {
      if (s === "che" && D === "چی") {
        s = "chī";
        unaccountedYeh--;
      } else s = "chi" + s.slice(3);
      rules.add("chi");
    } else if (s === "ke" && (D === undefined || D === "که")) {
      s = "ki";
      rules.add("short-i");
    } else if (s === "se" && (D === undefined || D === "سه")) {
      // سه is majhul sē everywhere else in the app; `si` would be a new error.
      s = "sē";
      rules.add("majhul-ē");
    }

    // The present prefix می is majhul mē-. `mekonad` for می‌کند lost the macron.
    if (/^(na)?me(?![ēāīōūy])/u.test(s) && D !== undefined && /^(ن)?می/u.test(D) && unaccountedYeh > 0) {
      s = s.replace(/^(na)?me/u, "$1mē");
      unaccountedYeh--;
      rules.add("mē-prefix");
    }

    // The subjunctive/imperative prefix is bu- (app convention), never be-.
    // Only when the rest really is a known present stem, in both scripts:
    // برنج `berenj` also opens with ب + a stem-shaped رنج.
    if (/^be(?![aeiouāēīōūy])/u.test(s) && D !== undefined && /^ب(?!ی)/u.test(D)) {
      const rest = i(s.slice(2));
      const hit = ctx.presentStems.find(
        (st) =>
          rest.startsWith(st.latin) &&
          D.slice(1).startsWith(st.dari) &&
          /^(|م|ی|د|یم|ید|ند|ن)$/u.test(D.slice(1 + st.dari.length)),
      );
      // A person ending on both sides (`berasad` / برسد) is a verb too, when no
      // stem table lists it: nouns do not end in -ad/-and matched by د/ند.
      const PERSON: ReadonlyArray<readonly [RegExp, RegExp]> = [
        [/and$/u, /ند$/u], [/ad$/u, /د$/u], [/am$/u, /م$/u], [/ēm$/u, /یم$/u], [/ēd$/u, /ید$/u],
      ];
      const personal = s.length >= 6 && PERSON.some(([l, d]) => l.test(s) && d.test(D));
      // بدهی `bedihi` is "debt", not "give!" + ی: a 2sg is written -ī, so a bare
      // final i is a noun, and so is any non-verb headword.
      const isVerb =
        (hit || personal || ctx.verbForms?.has(D)) && !/i$/u.test(s) && !ctx.nonVerbTargets?.has(D);
      if (isVerb) {
        s = "bu" + s.slice(2);
        rules.add("bu-prefix");
      }
    }

    // 3. 1pl -īm → -ēm, on a verb whose Dari ends in یم.
    const im = s.match(/^(.*?)[iī]m$/u);
    if (im && im[1] && (D === undefined ? /^(na)?mē/u.test(s) : /یم$/u.test(D))) {
      const stem = i(im[1].replace(/-$/, ""));
      if (isVerb1plStem(stem, ctx.isVerbStem)) {
        s = im[1] + "ēm";
        rules.add("1pl-ēm");
      }
    }

    // A final ه the Iranian convention spells -e/-eh is -a here, as in khāna.
    if (/[^aeiouāēīōū]eh?$/u.test(s) && s.length > 2) {
      const dariEndsInHe = D !== undefined && /ه$/u.test(D) && k === segs.length - 1 - trailingEzafe(segs);
      if (dariEndsInHe && (!/h$/u.test(s) || D.length >= 4)) {
        s = s.replace(/eh?$/u, "a");
        rules.add("final-a");
      } else if (/e$/u.test(s)) {
        skip ??= D === undefined ? "final e, no script" : `final e, script ${D}`;
        segs[k] = s;
        continue;
      }
    }

    // Iranian `ey`: before a vowel it is the i + glide of ziyādī, piyāda;
    // before a consonant the diphthong the app writes `ay` (kayfī, khayr).
    // Except the present prefix before a glide: میایم `meyāyum` is mē-yāyum,
    // and `miyāyum` would be the Iranian prefix.
    if (/^(na)?mey[aāeēiīoōuū]/u.test(s) && D !== undefined && /^(ن)?می[ا]/u.test(D)) {
      s = s.replace(/^(na)?me/u, "$1mē");
      rules.add("mē-prefix");
    }
    if (/ey/u.test(s)) {
      s = s.replace(/ey(?=[aāeēiīoōuū])/gu, "iy").replace(/ey/gu, "ay");
      rules.add("short-i");
    }

    if (/e/u.test(s)) {
      if (D !== undefined && unaccountedYeh > 0) {
        // The script writes a long vowel the Latin does not show. Exactly one
        // `e` and one missing ی: that e is the flattened ē.
        const bareE = (s.match(/e/g) ?? []).length;
        if (bareE === 1 && unaccountedYeh === 1) {
          s = s.replace("e", "ē");
          unaccountedYeh--;
          rules.add("majhul-ē");
        } else {
          skip ??= `script ${D} writes a long vowel the Latin lacks`;
        }
      } else if (D === undefined && /^(na)?me|^be/u.test(s)) {
        skip ??= "me-/be- with no script to tell prefix from stem";
      } else {
        s = i(s);
        rules.add("short-i");
      }
    }
    segs[k] = s;
  }

  let out = segs.join("-");
  if (cap) out = out.charAt(0).toUpperCase() + out.slice(1);
  if (out === nfc) return skip ? { ...same, skip } : same;
  return { out, rules: [...rules], skip };
}

function trailingEzafe(segs: string[]): number {
  const last = segs.length - 1;
  return last > 0 && isEzafeSegment(segs[last], last) ? 1 : 0;
}

/** Rewrite the Latin words of `text`, with a decision function per word. */
export function mapWords(
  text: string,
  decide: (word: string, index: number, afterHyphen: boolean) => string | undefined,
): string {
  let n = 0;
  return text.replace(LATIN_WORD, (word, offset: number, whole: string) => {
    const idx = n++;
    const afterHyphen = whole[offset - 1] === "-";
    // `-e` quoted as a word is the ezafe itself.
    if (/^y?e$/i.test(word) && afterHyphen) return word;
    return decide(word, idx, afterHyphen) ?? word;
  });
}

// --- corpus -------------------------------------------------------------------

type Kind = "paired" | "cells" | "alias" | "prose";

interface Field {
  source: string;
  unit: string;
  path: string;
  kind: Kind;
  get: () => string;
  set: (v: string) => void;
  /** Dari counterpart, for paired fields. */
  script?: string;
}

interface Edit {
  source: string;
  unit: string;
  path: string;
  from: string;
  to: string;
  rules: Rule[];
  evidence: "script" | "corpus" | "none" | "unit";
  before: string;
  after: string;
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const sampleAt = args.indexOf("--samples");
  const sampleN = sampleAt !== -1 ? Number(args[sampleAt + 1]) : 40;
  const repo = join(import.meta.dirname, "..");
  const content = join(repo, "content", "prs");

  const files = new Map<string, { path: string; data: unknown; raw: string; format: "json" | "json-nonl" | "ts" }>();
  function loadJson(rel: string) {
    const path = join(repo, rel);
    const raw = readFileSync(path, "utf8");
    files.set(rel, { path, raw, data: JSON.parse(raw), format: raw.endsWith("\n") ? "json" : "json-nonl" });
    return files.get(rel)!.data as Record<string, unknown>;
  }

  const fields: Field[] = [];
  const lexRel = "content/prs/lexicon/lexicon.json";
  const lexicon = loadJson(lexRel) as { entries: Array<Record<string, unknown>> };

  // --- verb stems from the lexicon and the conjugation table ---
  const presentStems: Array<{ latin: string; dari: string }> = [];
  const pastStems = new Set<string>();
  const addPresent = (latin: unknown, dari: unknown) => {
    if (typeof latin === "string" && typeof dari === "string" && latin.length >= 2) {
      presentStems.push({ latin: i(latin.normalize("NFC")), dari: normDari(dari) });
    }
  };
  for (const e of lexicon.entries) {
    if (e.pos !== "verb") continue;
    addPresent(e.presentStemTranslit, e.presentStem);
    const last = String(e.translit ?? "").normalize("NFC").split(/\s+/).pop() ?? "";
    if (/an$/u.test(last) && last.length > 4) pastStems.add(i(last.slice(0, -2)));
  }
  const conj = readFileSync(join(repo, "src/lib/lang/prs/conjugate.ts"), "utf8");
  for (const m of conj.matchAll(/presentStem: "([^"]+)", presentStemTranslit: "([^"]+)"/g)) addPresent(m[2], m[1]);
  presentStems.sort((a, b) => b.latin.length - a.latin.length);
  const presentLatin = new Set(presentStems.map((p) => p.latin));
  const verbForms = new Set<string>();
  const nonVerbTargets = new Set<string>();
  for (const e of lexicon.entries) {
    if (e.pos === "verb") for (const v of (e.variants as string[] | undefined) ?? []) verbForms.add(normDari(v));
    else nonVerbTargets.add(normDari(String(e.target)));
  }
  const ctx: Ctx = {
    verbForms,
    nonVerbTargets,
    presentStems,
    isVerbStem: (s) => s.length >= 3 && (pastStems.has(i(s)) || presentLatin.has(i(s))),
  };

  // --- lexicon ---
  for (const e of lexicon.entries) {
    const unit = String(e.id);
    for (const [f, sf] of [
      ["translit", "target"],
      ["exampleTranslit", "exampleTarget"],
      ["presentStemTranslit", "presentStem"],
    ] as const) {
      if (typeof e[f] !== "string") continue;
      fields.push({
        source: "lexicon",
        unit,
        path: f,
        kind: "paired",
        get: () => e[f] as string,
        set: (v) => { e[f] = v; },
        script: typeof e[sf] === "string" ? (e[sf] as string) : undefined,
      });
    }
  }

  // --- JSON trees: course, hub, placement controls ---
  const PROSE_KEYS = new Set([
    "title", "subtitle", "body", "grammarPointEn", "hint", "prompt", "en", "summary",
    "heading", "why", "note", "glossEn", "exampleEn",
  ]);
  const PROSE_ARRAY_KEYS = new Set(["distractorsEn"]);
  function walk(source: string, node: unknown, unit: string, path: string, unitRe: RegExp) {
    if (Array.isArray(node)) {
      node.forEach((v, idx) => walk(source, v, unit, `${path}[${idx}]`, unitRe));
      return;
    }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const u = typeof o.id === "string" && unitRe.test(o.id) ? o.id : unit;
    for (const [k, v] of Object.entries(o)) {
      const p = `${path}.${k}`;
      if (k === "translit" && typeof v === "string") {
        const script = [o.target, o.word].find((x): x is string => typeof x === "string");
        fields.push({ source, unit: u, path: p, kind: "paired", get: () => o.translit as string, set: (x) => { o.translit = x; }, script });
      } else if (PROSE_KEYS.has(k) && typeof v === "string") {
        fields.push({ source, unit: u, path: p, kind: "prose", get: () => o[k] as string, set: (x) => { o[k] = x; } });
      } else if ((k === "text" || k === "fixed") && typeof v === "string") {
        fields.push({ source, unit: u, path: p, kind: "cells", get: () => o[k] as string, set: (x) => { o[k] = x; } });
      } else if (k === "aliases" && Array.isArray(v)) {
        fields.push({ source, unit: u, path: p, kind: "alias", get: () => JSON.stringify(o.aliases), set: (x) => { o.aliases = JSON.parse(x); } });
      } else if ((k === "table" || k === "rows" || k === "columns") && Array.isArray(v)) {
        const cells: Array<[unknown[], number]> = [];
        const collect = (arr: unknown[]) => arr.forEach((c, idx) => (Array.isArray(c) ? collect(c) : typeof c === "string" && cells.push([arr, idx])));
        collect(v);
        for (const [arr, idx] of cells) {
          const cell = arr[idx] as string;
          const pair = cell.match(/^(.*?)(?:\s+[-–]|,)\s+([؀-ۿ‌\s]+)$/u);
          if (pair && !/[؀-ۿ]/u.test(pair[1])) {
            fields.push({
              source, unit: u, path: `${p}[${idx}]`, kind: "paired",
              get: () => (arr[idx] as string).replace(/(?:\s+[-–]|,)\s+[؀-ۿ‌\s]+$/u, ""),
              set: (x) => { arr[idx] = x + (arr[idx] as string).slice((arr[idx] as string).search(/(?:\s+[-–]|,)\s+[؀-ۿ‌\s]+$/u)); },
              script: pair[2],
            });
          } else {
            fields.push({ source, unit: u, path: `${p}[${idx}]`, kind: "cells", get: () => arr[idx] as string, set: (x) => { arr[idx] = x; } });
          }
        }
      } else if (PROSE_ARRAY_KEYS.has(k) && Array.isArray(v)) {
        v.forEach((_, idx) => {
          if (typeof v[idx] === "string") fields.push({ source, unit: u, path: `${p}[${idx}]`, kind: "prose", get: () => v[idx] as string, set: (x) => { v[idx] = x; } });
        });
      } else if (v && typeof v === "object") {
        walk(source, v, u, p, unitRe);
      }
    }
  }
  walk("course", loadJson("content/prs/grammar/all.json"), "", "", /^gl-/);
  walk("hub", loadJson("content/prs/grammar-hub/entries.json"), "", "", /^gh-/);
  walk("placement", loadJson("content/prs/lexicon/placement-controls.json"), "placement", "", /^$/);

  // --- level descriptions: Latin inside English, no unit of their own ---
  const levels = loadJson("content/prs/levels/levels.json") as { levels?: Array<Record<string, unknown>> };
  for (const lv of (levels.levels ?? []) as Array<Record<string, unknown>>) {
    const ga = lv.grammarAllowed;
    if (!Array.isArray(ga)) continue;
    ga.forEach((_, idx) => {
      fields.push({ source: "levels", unit: String(lv.id), path: `grammarAllowed[${idx}]`, kind: "cells", get: () => ga[idx] as string, set: (x) => { ga[idx] = x; } });
    });
  }

  // --- seed text sources (TypeScript) ---
  const tsEdits = new Map<string, Array<{ start: number; end: number; field: Field }>>();
  for (const rel of ["scripts/data/seed-texts-prs.ts", "scripts/data/seed-texts-prs.drafts.ts"]) {
    const path = join(repo, rel);
    const raw = readFileSync(path, "utf8");
    files.set(rel, { path, raw, data: null, format: "ts" });
    const spans: Array<{ start: number; end: number; field: Field }> = [];
    const slugs = [...raw.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => ({ at: m.index ?? 0, slug: m[1] }));
    const unitAt = (pos: number) => slugs.filter((s) => s.at <= pos).pop()?.slug ?? "?";
    const values = new Map<number, string>();
    const lit = /\b(\w+):\s*"((?:[^"\\]|\\.)*)"/g;
    const literals = [...raw.matchAll(lit)].map((m) => ({
      key: m[1],
      value: m[2],
      start: (m.index ?? 0) + m[0].length - m[2].length - 1,
    }));
    literals.forEach((l, idx) => {
      const isTranslit = /^(translit|titleTranslit|questionTranslit)$/.test(l.key);
      const isProse = /^(en|titleEn|questionEn)$/.test(l.key);
      if (!isTranslit && !isProse) return;
      values.set(l.start, l.value);
      let script: string | undefined;
      if (isTranslit) {
        const want = l.key.replace("Translit", "Target").replace(/^translit$/, "target");
        const prev = literals.slice(Math.max(0, idx - 3), idx).reverse().find((x) => x.key === want);
        script = prev?.value;
      }
      const field: Field = {
        source: rel.includes("drafts") ? "seed-drafts" : "seed",
        unit: unitAt(l.start),
        path: l.key,
        kind: isTranslit ? "paired" : "prose",
        get: () => values.get(l.start)!,
        set: (x) => { values.set(l.start, x); },
        script,
      };
      fields.push(field);
      spans.push({ start: l.start, end: l.start + l.value.length, field });
    });
    tsEdits.set(rel, spans);
  }

  // --- pass 1: decide every paired word with its script ---
  const unitMap = new Map<string, Map<string, string>>(); // unit -> old -> new
  const corpusVotes = new Map<string, Map<string, number>>();
  const skips = new Map<string, { n: number; reason: string; example: string }>();
  const decided = new Map<Field, Array<{ word: string; out?: string; rules: Rule[]; evidence: Edit["evidence"] }>>();

  const unitKey = (f: Field) => `${f.source}:${f.unit}`;
  for (const f of fields) {
    if (f.kind !== "paired") continue;
    const text = f.get();
    const words = [...text.normalize("NFC").matchAll(LATIN_WORD)].map((m) => m[0]);
    const dw = f.script !== undefined ? dariWords(f.script) : [];
    const aligned = f.script !== undefined && dw.length === words.length;
    const list: Array<{ word: string; out?: string; rules: Rule[]; evidence: Edit["evidence"] }> = [];
    words.forEach((word, idx) => {
      if (!aligned) {
        list.push({ word, rules: [], evidence: "none" });
        return;
      }
      const r = normaliseToken(word, dw[idx], ctx);
      if (r.skip) {
        const key = word.toLowerCase();
        const s = skips.get(key) ?? { n: 0, reason: r.skip, example: `${f.source} ${f.unit}: ${text}` };
        s.n++;
        skips.set(key, s);
      }
      if (r.out !== word.normalize("NFC")) {
        const um = unitMap.get(unitKey(f)) ?? new Map();
        um.set(word.normalize("NFC"), r.out);
        um.set(word.normalize("NFC").toLowerCase(), r.out.toLowerCase());
        unitMap.set(unitKey(f), um);
        const v = corpusVotes.get(word.toLowerCase()) ?? new Map();
        v.set(r.out.toLowerCase(), (v.get(r.out.toLowerCase()) ?? 0) + 1);
        corpusVotes.set(word.toLowerCase(), v);
      }
      list.push({ word, out: r.out, rules: r.rules, evidence: "script" });
    });
    decided.set(f, list);
  }

  // A word decided one way everywhere it had evidence.
  const corpusMap = new Map<string, string>();
  const conflicts: string[] = [];
  for (const [from, votes] of corpusVotes) {
    const sorted = [...votes].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 1) conflicts.push(`${from} → ${sorted.map(([t, n]) => `${t}×${n}`).join(", ")}`);
    corpusMap.set(from, sorted[0][0]);
  }
  const withCase = (orig: string, lower: string) =>
    /^\p{Lu}/u.test(orig) ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;

  // --- pass 2: apply ---
  const edits: Edit[] = [];
  const leftovers = new Map<string, { n: number; example: string }>();
  const record = (f: Field, before: string, after: string, from: string, to: string, rules: Rule[], evidence: Edit["evidence"]) =>
    edits.push({ source: f.source, unit: f.unit, path: f.path, from, to, rules, evidence, before, after });

  const hasMark = (w: string) => /[āēīōūṭ]/u.test(w.normalize("NFC"));
  const fromUnitOrCorpus = (f: Field, word: string, allowCorpus: boolean): { to: string; evidence: Edit["evidence"] } | undefined => {
    const nfc = word.normalize("NFC");
    const um = unitMap.get(unitKey(f));
    const u = um?.get(nfc) ?? um?.get(nfc.toLowerCase());
    if (u !== undefined) return { to: withCase(nfc, u.toLowerCase()), evidence: "unit" };
    if (allowCorpus && hasMark(nfc)) {
      const c = corpusMap.get(nfc.toLowerCase());
      if (c !== undefined) return { to: withCase(nfc, c), evidence: "corpus" };
    }
    return undefined;
  };

  /** A word in a field with no Dari of its own: prose, Latin-only cells, aliases. */
  const looseDecide = (
    f: Field,
    word: string,
    afterHyphen: boolean,
  ): { to: string; rules: Rule[]; evidence: Edit["evidence"] } | undefined => {
    const nfc = word.normalize("NFC");
    if (ENGLISH_WORDS.has(nfc.toLowerCase())) return undefined;
    // `che` is no English word, and text naming "what" means چه: chi.
    if (nfc.toLowerCase() === "che") return { to: withCase(nfc, "chi"), rules: ["chi"], evidence: "none" };
    // A quoted ending (`-eshān`) is not the word it looks like (ایشان `ēshān`),
    // so no map applies to it: `-emān, -etān, -eshān` are `-imān` and so on.
    if (afterHyphen) {
      const to = SUFFIX_QUOTES.get(nfc);
      return to ? { to, rules: ["short-i"], evidence: "none" } : undefined;
    }
    const hit = fromUnitOrCorpus(f, word, f.kind !== "prose" || hasMark(nfc));
    if (hit) return hit.to === nfc ? undefined : { to: hit.to, rules: [], evidence: hit.evidence };
    // A word with a macron no structured field decided (`ketābemān` in a table
    // of endings, `ketāb-e man` on a page about something else). A macron
    // cannot be English, so the script-free rules decide it.
    if (hasMark(nfc) && (shortEVowels(nfc).length || cheAsWord(nfc))) {
      const r = normaliseToken(nfc, undefined, ctx);
      if (r.out !== nfc) return { to: r.out, rules: r.rules, evidence: "none" };
    }
    return undefined;
  };

  for (const f of fields) {
    const before = f.get();
    let after = before;
    if (f.kind === "paired") {
      const list = decided.get(f)!;
      after = mapWords(before, (word, idx) => {
        const d = list[idx];
        if (!d || d.word !== word.normalize("NFC") && d.word !== word) return undefined;
        if (d.evidence === "script") {
          if (d.out && d.out !== word.normalize("NFC")) {
            record(f, before, "", word, d.out, d.rules, "script");
            return d.out;
          }
          return undefined;
        }
        // Unaligned: take the corpus decision, else decide without a script.
        const nfc = word.normalize("NFC");
        const c = corpusMap.get(nfc.toLowerCase());
        if (c !== undefined) {
          const to = withCase(nfc, c);
          if (to !== nfc) record(f, before, "", word, to, ["short-i"], "corpus");
          return to;
        }
        const r = normaliseToken(word, undefined, ctx);
        if (r.skip) {
          const s = skips.get(nfc.toLowerCase()) ?? { n: 0, reason: `${r.skip} (unaligned)`, example: `${f.source} ${f.unit}: ${before}` };
          s.n++;
          skips.set(nfc.toLowerCase(), s);
        }
        if (r.out !== nfc) {
          record(f, before, "", word, r.out, r.rules, "none");
          return r.out;
        }
        return undefined;
      });
    } else if (f.kind === "cells" || f.kind === "prose") {
      after = mapWords(before, (word, _idx, afterHyphen) => {
        const d = looseDecide(f, word, afterHyphen);
        if (!d) return undefined;
        record(f, before, "", word, d.to, d.rules, d.evidence);
        return d.to;
      });
    } else if (f.kind === "alias") {
      // Search aliases keep every old spelling, so "ketab" still finds the
      // page, and gain the convention's one beside it.
      const aliases = JSON.parse(before) as string[];
      const out: string[] = [];
      for (const a of aliases) {
        out.push(a);
        const na = mapWords(a, (word, _idx, afterHyphen) => {
          if (word.toLowerCase() === "ke") return "ki";
          return looseDecide(f, word, afterHyphen)?.to;
        });
        if (na !== a && !aliases.includes(na) && !out.includes(na)) {
          out.push(na);
          record(f, a, na, a, na, [], "unit");
        }
      }
      after = JSON.stringify(out);
    }
    if (after !== before) {
      for (const e of edits) if (e.after === "" && e.before === before && e.path === f.path && e.unit === f.unit) e.after = after;
      f.set(after);
    }
    // what the validator would still flag in this field
    if (f.kind === "paired" || f.kind === "cells") {
      for (const w of shortEVowels(after)) {
        if (f.kind === "cells" && (ENGLISH_WORDS.has(w.toLowerCase()) || !hasMark(w))) continue;
        const l = leftovers.get(w.toLowerCase()) ?? { n: 0, example: `${f.source} ${f.unit} ${f.path}: ${after}` };
        l.n++;
        leftovers.set(w.toLowerCase(), l);
      }
    }
  }

  // --- report ---
  const count = (key: (e: Edit) => string) => {
    const m = new Map<string, number>();
    for (const e of edits) m.set(key(e), (m.get(key(e)) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  console.log(`${edits.length} word edits (${apply ? "applied" : "dry run"})\n`);
  console.log("By rule:");
  const ruleCounts = new Map<string, number>();
  for (const e of edits) for (const r of e.rules.length ? e.rules : [`(reused: ${e.evidence})`]) ruleCounts.set(r, (ruleCounts.get(r) ?? 0) + 1);
  for (const [r, n] of [...ruleCounts].sort((a, b) => b[1] - a[1])) console.log(`  ${r.padEnd(22)} ${n}`);
  console.log("\nBy source and field:");
  for (const [k, n] of count((e) => `${e.source} ${e.path.replace(/\[\d+\]/g, "[]").replace(/^.*\./, "")}`)) console.log(`  ${k.padEnd(40)} ${n}`);
  console.log("\nBy evidence:");
  for (const [k, n] of count((e) => e.evidence)) console.log(`  ${k.padEnd(10)} ${n}`);

  // Deterministic sample spread over the edit list.
  const step = Math.max(1, Math.floor(edits.length / sampleN));
  console.log(`\nSample of ${Math.min(sampleN, edits.length)} edits:`);
  for (let k = 0, shown = 0; k < edits.length && shown < sampleN; k += step, shown++) {
    const e = edits[k];
    console.log(`  [${e.source} ${e.unit} ${e.path}] ${e.from} → ${e.to} (${e.rules.join(",") || e.evidence})`);
  }

  if (conflicts.length) {
    console.log(`\nWords decided more than one way (${conflicts.length}; the majority is used where there was no script):`);
    for (const c of conflicts.slice(0, 40)) console.log(`  ${c}`);
  }
  console.log(`\nLeft unchanged, ambiguous (${skips.size} words):`);
  for (const [w, s] of [...skips].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${w} ×${s.n} - ${s.reason}\n      ${s.example.slice(0, 140)}`);
  console.log(`\nStill flagged by shortEVowel after this run (${leftovers.size} words):`);
  for (const [w, l] of [...leftovers].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${w} ×${l.n}  ${l.example.slice(0, 140)}`);

  // Validator-shaped counts over the structured fields.
  const measure = (texts: string[]) => ({
    shortE: texts.reduce((n, t) => n + shortEVowels(t).length, 0),
    che: texts.reduce((n, t) => n + (t.match(/(?<![\p{L}\p{M}'’-])che(?![\p{L}\p{M}'’-])/giu) ?? []).length, 0),
    im1pl: texts.filter((t) => verb1plIm(t, ctx.isVerbStem)).length,
  });
  const paired = fields.filter((f) => f.kind === "paired");
  const beforeTexts = paired.map((f) => edits.find((e) => e.path === f.path && e.unit === f.unit && e.after === f.get())?.before ?? f.get());
  console.log("\nStructured transliteration fields:", "before", JSON.stringify(measure(beforeTexts)), "after", JSON.stringify(measure(paired.map((f) => f.get()))));

  if (args.includes("--json")) {
    writeFileSync(args[args.indexOf("--json") + 1], JSON.stringify({ edits, skips: [...skips], leftovers: [...leftovers] }, null, 1));
  }

  if (args.includes("--scan-code")) {
    const dir = join(repo, "src/lib/lang/prs");
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      const text = readFileSync(join(dir, name), "utf8");
      text.split("\n").forEach((line, ln) => {
        for (const m of line.matchAll(LATIN_WORD)) {
          const c = corpusMap.get(m[0].normalize("NFC").toLowerCase());
          if (c && hasMark(m[0]) && c !== m[0].toLowerCase()) console.log(`  ${name}:${ln + 1} ${m[0]} → ${c}`);
        }
      });
    }
  }

  if (!apply) return;
  for (const [rel, file] of files) {
    if (file.format === "ts") {
      let text = file.raw;
      const spans = [...(tsEdits.get(rel) ?? [])].sort((a, b) => b.start - a.start);
      for (const s of spans) text = text.slice(0, s.start) + s.field.get() + text.slice(s.end);
      if (text !== file.raw) writeFileSync(file.path, text);
    } else {
      const text = JSON.stringify(file.data, null, 2) + (file.format === "json" ? "\n" : "");
      if (text !== file.raw) writeFileSync(file.path, text);
    }
  }
  console.log("\nWritten.");
}

if (process.argv[1] && import.meta.filename === realpathSync(process.argv[1])) main();
