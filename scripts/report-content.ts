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
        const light = byId.get(compoundId)!.targetNormalized.split(" ")[1];
        const stem = light.replace(/(دن|تن)$/u, "");
        if (stem.length < 2 || !next.surface.includes(stem.slice(0, 2))) return;
        const got = t.lexemeId ? byId.get(t.lexemeId) : null;
        hits.push(`${doc.id}: "${t.surface} ${next.surface}" taps as ${got ? `"${got.glossEn}"` : "unresolved"}`);
      });
    }
  }
  console.log(`${compounds.length} compound verbs in the dictionary`);
  console.log(`${hits.length} place(s) where tapping the first half teaches the wrong word:`);
  for (const h of hits.slice(0, 12)) console.log(`  ${h}`);
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
