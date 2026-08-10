/**
 * Checks a generated text must pass before anyone reads it.
 *
 * Deliberately free of model calls. Everything here is decidable from the text,
 * the level and the lexicon, so it costs nothing, runs in tests without a
 * provider, and gives the same answer twice. That matters more than it sounds:
 * the pipeline's only structural check used to be a model asked whether one
 * hand-written sentence about syntax had been violated, which cost a call out of
 * a 45-second budget shared with three others and failed open when it errored.
 *
 * Each check returns a `TextDefect` or nothing. The caller decides what to do
 * with them - the generator repairs and retries, the audit reports.
 */

import type { Level, TextDocument } from "./schema.ts";
import { tokenize } from "../text/index.ts";
import { profile } from "../lang/index.ts";

export interface TextDefect {
  /** Stable identifier, so a caller can decide per kind. */
  kind:
    | "sentence-count"
    | "sentence-length"
    | "coverage"
    | "teaching"
    | "gloss"
    | "interference"
    | "cohesion";
  message: string;
  /**
   * Whether this defect should block the text or just be surfaced to a
   * reviewer. `checkShape`'s two kinds are always `"reject"` - the caller
   * already throws on any shape defect regardless of this field, so this is
   * additive, not a behaviour change for the existing gate.
   */
  severity: "reject" | "flag";
}

/**
 * Does the text have the shape its level asked for?
 *
 * Nothing checked this. `outputSchema` in `ai/generate.ts` requires two
 * sentences and says nothing at all about their length, while every level
 * declares both a `sentenceRange` and a words-per-sentence ceiling - so a
 * pre-A1 text of two thirty-word sentences satisfied every gate in the
 * pipeline and was cached for every learner at that level.
 *
 * Length is counted in tokens, not in `String.split(" ")`, because the
 * tokenizer is what the rest of the pipeline counts with (`assemble` measures
 * coverage in tokens) and because splitting on spaces is wrong in both
 * languages - it counts Catalan `l'home` as one word and is undefined for a
 * script whose punctuation the tokenizer strips.
 */
export function checkShape(
  doc: TextDocument,
  level: Level,
  /**
   * How far outside `sentenceRange` a text may fall before it is rejected.
   *
   * Zero on the attempts that can afford to be strict, one on the last, which
   * is the same shape as `requiredTargets` in `ai/generate.ts` and exists for
   * the same reason: a five-sentence text where the level wanted six is worth
   * having, and an empty pool is the failure the whole contract exists to
   * prevent. Length is never tolerated - a sentence past the ceiling is not
   * readable at the level, which is the entire point of the ceiling.
   */
  sentenceCountTolerance = 0,
): TextDefect[] {
  const defects: TextDefect[] = [];
  const [min, max] = level.sentenceRange;
  const minS = Math.max(1, min - sentenceCountTolerance);
  const maxS = max + sentenceCountTolerance;
  const n = doc.sentences.length;

  if (n < minS || n > maxS) {
    defects.push({
      kind: "sentence-count",
      message: `${n} sentences, ${level.id} asks for ${min}-${max}`,
      severity: "reject",
    });
  }

  const overlong = doc.sentences
    .map((s, i) => ({ i, words: tokenize(s.target).length }))
    .filter((s) => s.words > level.maxSentenceWords);

  if (overlong.length > 0) {
    defects.push({
      kind: "sentence-length",
      message:
        `${overlong.length} sentence(s) over ${level.maxSentenceWords} words at ${level.id}: ` +
        overlong.map((s) => `#${s.i} (${s.words})`).join(", "),
      severity: "reject",
    });
  }

  return defects;
}

/**
 * Does the text stay inside the vocabulary it is allowed to draw from?
 *
 * `allowedIds` is the caller's call: `generateText` measures against the
 * *level's* whole known vocabulary (PEDAGOGY §8 - measurement set is never the
 * prompt slice), while an authoring pass reviewing one drafted text can pass a
 * slot's narrower allowance (cumulative introduced ∪ closed classes ∪ this
 * slot's own words) to catch a text that reached for something outside its
 * assignment.
 */
export function checkCoverage(
  doc: TextDocument,
  level: Level,
  allowedIds: ReadonlySet<string> | readonly string[],
): TextDefect[] {
  const allowed = allowedIds instanceof Set ? allowedIds : new Set(allowedIds);
  const outOfBand = doc.vocabUsed.filter((id) => !allowed.has(id));

  if (outOfBand.length === 0) return [];

  return [
    {
      kind: "coverage",
      message: `${outOfBand.length} word(s) at ${level.id} outside the allowed vocabulary: ${outOfBand.slice(0, 10).join(", ")}${outOfBand.length > 10 ? "…" : ""}`,
      severity: "reject",
    },
  ];
}

/**
 * A taught word must appear at all - PEDAGOGY §7's 6-12 meaningful encounters
 * accumulate *across* the SRS review loop and later texts' `reuses`, not
 * within one text ("this changes which known words a text reuses, not what
 * it teaches"). Requiring 2+ inside a single 4-6 sentence, 8-word-ceiling L1
 * text is unmeetable without repeating a word unnaturally, and measured
 * against the shipped, already-reviewed seed texts (`la casa és gran / el
 * pare i la mare són a casa / ...`), it rejected every one of them - the
 * check was wrong, not the content. Matches `generateText`'s own contract
 * (`MIN_TARGET_USE` counts a target as taught once used at all).
 */
const MIN_OCCURRENCES_PER_TAUGHT_WORD = 1;

/**
 * Does the text actually teach the words it was assigned?
 *
 * A text that never uses one of its assigned words has not taught it - a
 * word that never appears at all is a slot silently unfulfilled, the same
 * failure `generateText`'s own `newWords.length < needed` gate exists to
 * catch, made checkable for an authored (not generated) text that has no
 * such gate.
 */
export function checkTeaching(doc: TextDocument, expectedNew: readonly string[]): TextDefect[] {
  const counts = new Map<string, number>();
  for (const sentence of doc.sentences) {
    for (const token of sentence.tokens) {
      if (!token.lexemeId) continue;
      counts.set(token.lexemeId, (counts.get(token.lexemeId) ?? 0) + 1);
    }
  }

  const short = expectedNew
    .map((id) => ({ id, count: counts.get(id) ?? 0 }))
    .filter((w) => w.count < MIN_OCCURRENCES_PER_TAUGHT_WORD);

  if (short.length === 0) return [];

  return [
    {
      kind: "teaching",
      message: `${short.length} assigned word(s) undertaught (need ${MIN_OCCURRENCES_PER_TAUGHT_WORD}+ occurrences): ${short.map((w) => `${w.id} (${w.count}x)`).join(", ")}`,
      severity: "reject",
    },
  ];
}

/**
 * A sentence translation that reads like a dictionary entry rather than a
 * sentence - the exact defect §12 of PEDAGOGY exists to name: `glossEn` is a
 * dictionary gloss, and a sentence built by interpolating one produces "land,
 * ground, earth" where a translation belongs.
 *
 * Heuristic, so `flag` not `reject`: the "no verb" signal is a small fixed
 * list of common English verb forms, not a parser, and will miss real verbs
 * outside it. A false negative here just means a bad gloss ships unflagged,
 * same as before this check existed; a false positive only costs a reviewer
 * a second look at a line that is in fact fine.
 */
const COMMON_ENGLISH_VERB_SIGNAL =
  /\b(am|is|are|was|were|be|being|been|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must|go|goes|going|went|like|likes|liked|want|wants|wanted|need|needs|needed|eat|eats|ate|drink|drinks|drank|live|lives|lived|work|works|worked|study|studies|studied|play|plays|played|read|reads|speak|speaks|spoke|see|sees|saw|know|knows|knew|think|thinks|thought|come|comes|came|make|makes|made|take|takes|took|give|gives|gave|buy|buys|bought|sell|sells|sold|open|opens|opened|close|closes|closed|says?|said|walks?|walked|runs?|ran|sleeps?|slept|sits?|sat|stands?|stood)\b/i;

/** A dictionary gloss with no sentence-ending punctuation and no verb signal. */
const BARE_MULTI_SENSE_GLOSS = /^[^.!?]*,[^.!?]*$/;

export function checkGloss(doc: TextDocument): TextDefect[] {
  const bad = doc.sentences
    .map((s, i) => ({ i, en: s.en.trim(), target: s.target.trim() }))
    .filter(
      (s) =>
        s.en.length === 0 ||
        s.en === s.target ||
        (BARE_MULTI_SENSE_GLOSS.test(s.en) && !COMMON_ENGLISH_VERB_SIGNAL.test(s.en)),
    );

  if (bad.length === 0) return [];

  return [
    {
      kind: "gloss",
      message: `${bad.length} sentence(s) with a gloss-shaped translation instead of a sentence: ${bad.map((s) => `#${s.i} "${s.en}"`).join("; ")}`,
      severity: "flag",
    },
  ];
}

/**
 * Interference from the dominant neighbour language, the failure PEDAGOGY §9
 * names: fluent, confident, wrong. A short, deliberately literal list of the
 * collocations `profile.prompts.interference` already tells the model never
 * to write - this is what turns that prompt instruction into something a
 * build can also check, for authored text the prompt never reached.
 *
 * Catalan patterns require a reflexive/agreement shape, not just the bare
 * word, where a legitimate homograph exists (`compte` alone means "care" or
 * "account" and is common Catalan; only the reflexive "donar-se compte"
 * shape is the Spanish-interference error).
 */
const CA_INTERFERENCE: Array<{ id: string; re: RegExp }> = [
  {
    id: "tenir que",
    re: /\b(tenir|tinc|tens|té|tenim|teniu|tenen|tenia|tenies|teníem|teníeu|tenien|tingut|tindré|tindràs|tindrà|tindrem|tindreu|tindran)\s+que\b/iu,
  },
  { id: "hi han", re: /\bhi\s+han\b/iu },
  {
    id: "donar-se compte",
    re: /\b(em|et|es|ens|us|se)\s*'?\s*(dono|dones|dona|donem|doneu|donen)\s+compte\b|\bdonar-se\s+compte\b/iu,
  },
  { id: "lo + adjective", re: /\blo\s+\S/iu },
  {
    id: "personal a",
    re: /\b(veig|veus|veu|veiem|veieu|veuen|busco|busques|busca|busquem|busqueu|busquen|trobo|trobes|troba|trobem|trobeu|troben|conec|coneixes|coneix|coneixem|coneixeu|coneixen)\s+a\s+(el|la|els|les|un|una|uns|unes)\b/iu,
  },
];

/**
 * Iranian Persian words a Dari text must never use - see `INTERFERENCE` in
 * `lang/prs/prompts.ts`. Exported so `schedule.ts` can exclude these from the
 * pool of words a curriculum slot may be assigned to *teach* - found when a
 * hand-authored L2 batch was assigned `بزرگ` (big) as a required target and
 * this very check rejected the text for using it. The word was never
 * excludable from a check that only ever saw the finished text; the schedule
 * that assigned it in the first place had no way to know.
 */
export const PRS_IRANIAN_WORDS = ["مدرسه", "دانشگاه", "بیمارستان", "ماشین", "خیابان", "بزرگ", "پول", "هواپیما", "استان"];
/**
 * می glued straight to the verb stem with no ZWNJ (U+200C) between them.
 *
 * Anchored to the start of a word (not preceded by a Perso-Arabic letter) -
 * without that, `می` matched as a bare substring anywhere in the text, so
 * `زمین` (land, `zamīn`) - where `می` falls mid-word, after `ز` - false-
 * positived on every occurrence. A word that genuinely *starts* with `می` but
 * isn't a verb (`میز`, table) is a separate, harder case this still cannot
 * rule out without a real dictionary lookup; avoid that shape in authored
 * text for now rather than risk a false negative from a looser fix.
 */
const PRS_MI_WITHOUT_ZWNJ = /(?<![؀-ۿ])می(?![‌\s])/u;

export function checkInterference(doc: TextDocument): TextDefect[] {
  const text = doc.sentences.map((s) => s.target).join(" ");
  const hits: string[] = [];

  if (profile.code === "ca") {
    for (const { id, re } of CA_INTERFERENCE) {
      if (re.test(text)) hits.push(id);
    }
  } else if (profile.code === "prs") {
    for (const word of PRS_IRANIAN_WORDS) {
      if (text.includes(word)) hits.push(`Iranian Persian "${word}"`);
    }
    if (PRS_MI_WITHOUT_ZWNJ.test(text)) hits.push("می without ZWNJ");
  }

  if (hits.length === 0) return [];

  return [
    {
      kind: "interference",
      message: `interference pattern(s) found: ${hits.join(", ")}`,
      severity: "reject",
    },
  ];
}

/**
 * Pronoun surface forms, by language, for anaphor detection in
 * `checkCohesion`. Pulled from the lexicon's own `pos: "pronoun"` entries
 * (a genuinely closed class - PEDAGOGY §5 - so a short literal list is
 * complete, not an approximation) rather than resolved through the lexicon at
 * runtime: this module is imported from plain `node scripts/*.ts` (`review-
 * batch.ts --texts`, no bundler, no `@content` alias) as well as from the app,
 * and `content/load.ts` is bundler-only - see CLAUDE.md "content/active is
 * one shared symlink" and the plan's note on `src/lib/lang/<code>/` circular
 * imports, the same class of hazard one level up the import graph.
 */
const ANAPHORS: Record<string, RegExp> = {
  ca: /\b(es|hi|això|li|ell|ella|em|ens|et|us|ells|elles|jo|tu|mi|algú|ningú|nosaltres|tothom|vostè|allò|quelcom|vosaltres|cadascun|hom|ho)\b/iu,
  prs: /(من|او|تو|ما|آنها|شما|خود|همین|اون|همون|ایشان|مرا)/u,
};

/**
 * Does each sentence connect to the one before it?
 *
 * Four independent facts about a shared topic are not a text - the frame
 * generator this repo already retired produced exactly that (a river, a
 * flower, some land, a tree: one semantic field, zero shared referents). A
 * sentence that repeats a lexeme from its predecessor or picks it up with a
 * pronoun is continuing a thought; one that does neither is a new,
 * disconnected fact wearing the same topic as camouflage.
 */
export function checkCohesion(doc: TextDocument): TextDefect[] {
  const anaphor = ANAPHORS[profile.code];
  const disconnected: number[] = [];

  for (let i = 1; i < doc.sentences.length; i++) {
    const prevIds = new Set(doc.sentences[i - 1].tokens.map((t) => t.lexemeId).filter((id): id is string => !!id));
    const cur = doc.sentences[i];

    const sharesLexeme = cur.tokens.some((t) => t.lexemeId && prevIds.has(t.lexemeId));
    const hasAnaphor = !!anaphor && anaphor.test(cur.target);

    if (!sharesLexeme && !hasAnaphor) disconnected.push(i);
  }

  if (disconnected.length === 0) return [];

  return [
    {
      kind: "cohesion",
      message: `sentence(s) sharing no lexeme and no anaphor with the previous one: ${disconnected.map((i) => `#${i}`).join(", ")}`,
      severity: "flag",
    },
  ];
}
