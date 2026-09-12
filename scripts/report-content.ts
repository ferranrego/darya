/**
 * What the content actually looks like, in numbers.
 *
 * This repo's first rule is: measure the output, do not read the code and
 * conclude it works. There was no instrument. Every number in the audit that
 * produced this refactor - 273 of 400 sentences with no pronunciation, 89 of
 * 93 texts reaching a learner, 221 words shown exactly once - had to be
 * counted by hand with a one-line node script, which is why none of them was
 * noticed for months while they got worse.
 *
 * This is that command. Read-only, offline, no model call. Run it before and
 * after any content change:
 *
 *   pnpm report:content
 *
 * It is deliberately NOT a gate. A gate says pass or fail; this says what the
 * numbers are, including the ones nobody has decided a threshold for yet. The
 * things that do have thresholds are already in `validate-content.ts`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { contentRoot } from "./content-path.ts";
import { profile as langProfile } from "../src/lib/lang/index.ts";
import {
  lexiconFileSchema,
  textDocumentSchema,
  type LexiconEntry,
  type TextDocument,
} from "../src/lib/content/schema.ts";

const root = contentRoot();
const lexicon = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
);
const index = langProfile.text.buildIndex(lexicon.entries);
const byLexemeId = new Map(lexicon.entries.map((e) => [e.id, e]));
const seedDir = join(root, "texts", "seed");
const docs: TextDocument[] = readdirSync(seedDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => textDocumentSchema.parse(JSON.parse(readFileSync(join(seedDir, f), "utf8"))));

function pct(n: number, of: number): string {
  return of === 0 ? "n/a" : `${Math.round((n / of) * 100)}%`;
}

function heading(text: string): void {
  console.log(`\n${text}\n${"-".repeat(text.length)}`);
}

heading("Pronunciation");
{
  // The app has no audio at all, so this Latin line is the entire pronunciation
  // of the language. Two thirds of the beginner course was once taught mute.
  let sentences = 0;
  let missing = 0;
  for (const doc of docs) {
    for (const s of doc.sentences) {
      sentences++;
      if (!s.translit) missing++;
    }
  }
  const titles = docs.filter((d) => !d.titleTranslit).length;
  console.log(`${missing} of ${sentences} sentences have no pronunciation (${pct(missing, sentences)})`);
  console.log(`${titles} of ${docs.length} titles have none`);
  const noTranslit = lexicon.entries.filter((e) => !e.translit).length;
  console.log(`${noTranslit} of ${lexicon.entries.length} dictionary entries have none`);
}

heading("Texts");
{
  console.log(`${docs.length} texts reach the app`);
  const byLevel = new Map<string, number>();
  for (const doc of docs) byLevel.set(doc.level, (byLevel.get(doc.level) ?? 0) + 1);
  for (const [level, n] of [...byLevel].sort()) {
    const at = docs.filter((d) => d.level === level);
    const sentences = at.reduce((sum, d) => sum + d.sentences.length, 0);
    console.log(`  ${level}: ${n} texts, ${sentences} sentences, ${(sentences / n).toFixed(1)} per text`);
  }
}

heading("Comprehension questions");
{
  // Hand-written questions win where they exist; derived ones need four
  // sentences to draw plausible wrong options from.
  const authored = docs.filter((d) => d.questions.length > 0);
  const derivable = docs.filter((d) => d.sentences.length >= 4);
  const covered = new Set([...authored, ...derivable].map((d) => d.id));
  console.log(`${authored.length} of ${docs.length} texts have hand-written questions`);
  console.log(`${derivable.length} are long enough to derive questions from`);
  console.log(`${covered.size} of ${docs.length} texts can be quizzed at all (${pct(covered.size, docs.length)})`);
  const orphans = docs.filter((d) => !covered.has(d.id));
  for (const d of orphans) console.log(`  unquizzable: ${d.id} (${d.sentences.length} sentences)`);
}

heading("Re-exposure (PEDAGOGY §7 wants 6-12 encounters)");
{
  for (const level of ["L1", "L2"]) {
    const at = docs.filter((d) => d.level === level);
    const counts = new Map<string, number>();
    let appearances = 0;
    for (const doc of at) {
      for (const s of doc.sentences) {
        for (const t of s.tokens) {
          if (!t.lexemeId) continue;
          counts.set(t.lexemeId, (counts.get(t.lexemeId) ?? 0) + 1);
          appearances++;
        }
      }
    }
    const ids = [...counts.keys()];
    const once = ids.filter((id) => counts.get(id) === 1).length;
    const enough = ids.filter((id) => (counts.get(id) ?? 0) >= 6).length;
    console.log(
      `${level}: ${ids.length} words, ${appearances} appearances, ` +
        `seen once ${once} (${pct(once, ids.length)}), seen 6+ ${enough} (${pct(enough, ids.length)})`,
    );
  }
  // The whole beginner course together, which is what a learner actually meets.
  const beginner = docs.filter((d) => d.level === "L1" || d.level === "L2");
  const counts = new Map<string, number>();
  for (const doc of beginner) {
    for (const s of doc.sentences) {
      for (const t of s.tokens) {
        if (t.lexemeId) counts.set(t.lexemeId, (counts.get(t.lexemeId) ?? 0) + 1);
      }
    }
  }
  const ids = [...counts.keys()];
  const once = ids.filter((id) => counts.get(id) === 1).length;
  console.log(`L1+L2 together: ${ids.length} words, seen once ${once} (${pct(once, ids.length)})`);
}

heading("What is left in the re-exposure backlog, and why");
{
  /**
   * Not every backlogged word should be taught to six.
   *
   * The backlog was taken from what the texts happened to contain, so it lists
   * words that got in by accident as well as words the course means to teach.
   * Two groups will never be closed by writing more beginner texts, and saying
   * so is more useful than a single number that quietly never reaches zero:
   *
   *  - **Out of band.** L1 allows frequency bands 1-3 and L2 bands 1-5.
   *    Teaching a band-8 word six times at L1 would break the level's own
   *    spec, so these should leave the beginner texts rather than be repeated
   *    in them.
   *  - **Not beginner vocabulary.** Literary verbs a Kabuli speaker would not
   *    use (گریستن for "to cry", آشامیدن for "to drink"), and words no
   *    beginner course should drill at all.
   */
  const counts = new Map<string, number>();
  for (const doc of docs) {
    if (doc.level !== "L1" && doc.level !== "L2") continue;
    for (const s of doc.sentences) {
      for (const t of s.tokens) if (t.lexemeId) counts.set(t.lexemeId, (counts.get(t.lexemeId) ?? 0) + 1);
    }
  }
  const byId = new Map(lexicon.entries.map((e) => [e.id, e]));
  const backlogPath = join(root, "texts", "re-exposure-backlog.json");
  const ids: string[] = JSON.parse(readFileSync(backlogPath, "utf8")).lexemeIds;
  const short = ids
    .map((id) => ({ e: byId.get(id), n: counts.get(id) ?? 0 }))
    .filter((r): r is { e: LexiconEntry; n: number } => !!r.e && r.n < 6);
  const outOfBand = short.filter((r) => r.e.freqBand >= 4);
  const inBand = short.filter((r) => r.e.freqBand <= 3);
  console.log(`${ids.length} words were backlogged; ${ids.length - short.length} now reach six`);
  console.log(`${short.length} still short:`);
  console.log(`  ${outOfBand.length} are band 4+, above the beginner levels' own frequency bands`);
  console.log(`  ${inBand.length} are band 1-3 and worth teaching (${inBand.reduce((n, r) => n + (6 - r.n), 0)} appearances short)`);
}

heading("Compound verbs a learner taps the wrong half of");
{
  /**
   * The tokenizer splits compound verbs, so each half resolves on its own.
   * For کار کردن that is harmless - tapping کار and being told "work" is
   * roughly right. For دوست داشتن it is not: the learner taps دوست in "I like
   * this book" and the app teaches them "friend".
   *
   * Reported rather than fixed, because the fix is not local. Pointing both
   * tokens at the compound lexeme would be rejected by the seed-text token
   * check in `validate-content.ts`, which asserts that a token's stored id is
   * what `resolve(surface)` returns - and resolve, having no sentence context,
   * correctly returns the noun. Changing that is a decision about the
   * tokenizer, not a content repair.
   */
  const byId = new Map(lexicon.entries.map((e) => [e.id, e]));
  // Two-word compounds only. A four-word idiom like "به منصه ظهور رساندن"
  // starts with به, and matching on that alone reported every "به من" in the
  // corpus as a mistokenised verb - a report that cries wolf gets ignored,
  // which is worse than no report.
  const compounds = lexicon.entries.filter(
    (e) => e.pos === "verb" && e.targetNormalized.split(" ").length === 2,
  );
  const firstHalf = new Map<string, string>();
  for (const c of compounds) firstHalf.set(c.targetNormalized.split(" ")[0], c.id);

  const hits: string[] = [];
  for (const doc of docs) {
    for (const sentence of doc.sentences) {
      sentence.tokens.forEach((t, i) => {
        const compoundId = firstHalf.get(t.surface);
        const next = sentence.tokens[i + 1];
        if (!compoundId || !next || t.lexemeId === compoundId) return;
        // Resolve the next token rather than matching letters in it. A
        // substring test reported "این کار فکر می‌کنم" as a mistokenised
        // کار کردن, because فکر happens to contain the letters of کردن's
        // stem - a report that cries wolf gets ignored.
        const light = byId.get(compoundId)!.targetNormalized.split(" ")[1];
        if (index.resolve(next.surface)?.id !== index.resolve(light)?.id) return;
        const got = t.lexemeId ? byId.get(t.lexemeId) : null;
        hits.push(`${doc.id}: "${t.surface} ${next.surface}" taps as ${got ? `"${got.glossEn}"` : "unresolved"}`);
      });
    }
  }
  console.log(`${compounds.length} compound verbs in the dictionary`);
  console.log(`${hits.length} place(s) where tapping the first half teaches the wrong word:`);
  for (const h of hits.slice(0, 12)) console.log(`  ${h}`);
}

heading("Words the beginner texts and the dictionary spell differently");
{
  /**
   * The same word, two spellings, one tap apart.
   *
   * Transliteration is the app's only pronunciation guide - there is no audio -
   * so a word spelled `marēz` in the sentence and `marīz` on the card it opens
   * teaches two pronunciations of one word. A corpus-wide audit counts 2,678 of
   * these, which is too many to act on; this lists only the beginner texts,
   * where they matter most and where the list is short enough to take to a
   * philologist.
   *
   * Deliberately not auto-fixed. Every one of these is a vowel-quality call
   * (ē vs ī, e vs i, ō vs ū) where both spellings are well-formed, so the
   * repo's own flattening rule settles none of them - it was tried, and it
   * settled zero. An earlier attempt to normalise them by corpus majority made
   * things worse, turning `shīsha` into the Iranian `shishe`, because the
   * majority is not the authority. A native Kabuli speaker is.
   */
  const rows = new Map<string, { script: string; lex: string; text: string; n: number }>();
  for (const doc of docs) {
    if (doc.level !== "L1" && doc.level !== "L2") continue;
    for (const s of doc.sentences) {
      if (!s.translit) continue;
      const words = s.translit.replace(/[.,!?؟،]/g, "").split(/\s+/);
      if (words.length !== s.tokens.length) continue;
      s.tokens.forEach((t, i) => {
        if (!t.lexemeId) return;
        const e = byLexemeId.get(t.lexemeId);
        if (!e?.translit || t.surface !== e.targetNormalized) return;
        const w = words[i].replace(/-(e|ye)$/u, "");
        if (!w || w.toLowerCase() === e.translit.toLowerCase()) return;
        const key = `${e.id}|${w}`;
        const row = rows.get(key) ?? { script: e.targetNormalized, lex: e.translit, text: w, n: 0 };
        row.n += 1;
        rows.set(key, row);
      });
    }
  }
  const sorted = [...rows.values()].sort((a, b) => b.n - a.n);
  console.log(`${sorted.length} words are spelled one way in a beginner sentence and another on their card:`);
  for (const r of sorted.slice(0, 20)) {
    console.log(`  ${r.script.padEnd(12)} card "${r.lex}" vs text "${r.text}" (${r.n}x)`);
  }
  if (sorted.length > 20) console.log(`  … and ${sorted.length - 20} more`);
}

heading("Register (the app teaches a register nobody speaks)");
{
  const byRegister = new Map<string, number>();
  for (const e of lexicon.entries) {
    byRegister.set(e.register, (byRegister.get(e.register) ?? 0) + 1);
  }
  for (const [register, n] of [...byRegister].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${register}: ${n} (${pct(n, lexicon.entries.length)})`);
  }
  const phrases = lexicon.entries.filter((e) => e.pos === "phrase").length;
  console.log(`  set phrases: ${phrases} of ${lexicon.entries.length}`);
}

heading("Dictionary");
{
  const byPos = new Map<string, number>();
  for (const e of lexicon.entries) byPos.set(e.pos, (byPos.get(e.pos) ?? 0) + 1);
  console.log(`${lexicon.entries.length} entries`);
  for (const [pos, n] of [...byPos].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pos}: ${n}`);
  }
  // A word with no example sentence cannot be taught in context, only defined.
  const noExample = lexicon.entries.filter((e: LexiconEntry) => !e.exampleTarget).length;
  console.log(`${noExample} entries have no example sentence`);
}

console.log("");
