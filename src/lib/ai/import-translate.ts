import "server-only";
import { z } from "zod";
import { profile } from "../lang/index.ts";
import { LANGUAGE_NAME, requiredTranslitField, TRANSLIT_INSTRUCTION, TRANSLITERATED } from "./lang-format.ts";
import { completeJson } from "./providers.ts";

/**
 * Translating an article the learner brought in.
 *
 * Two things make this different from every other prompt in this directory, and
 * both are deliberate:
 *
 * 1. The target text is NOT model output. It is the learner's own article, and
 *    it is never sent back for the model to rewrite - only English (and, where
 *    the language has one, a transliteration) comes back. So a hallucination
 *    here can spoil a gloss and nothing else: it can never put a word into the
 *    text the learner reads. This is why the usual `assertKnownVocab` /
 *    `isKnownToken` guards do not apply, and must not be added: a real article
 *    is full of words outside the lexicon, which is the entire point.
 *
 * 2. Cost. A whole article is far too much to translate in one request - ten
 *    sequential calls inside a 60s function, on a free-tier quota shared by
 *    every learner of the deployment. So the import translates the title and
 *    the opening sentences (ONE call), and the rest arrive three at a time as
 *    the learner opens them (ONE call per three sentences, and only for
 *    sentences they actually open). Most readings cost a handful of calls.
 */

/** Sentences translated eagerly at import, so the reading opens complete. */
export const EAGER_SENTENCES = 5;
/** Sentences per lazy call - the requested one plus the next two. */
export const LAZY_BATCH = 3;

/** Asked for where the language has one, absent where it does not. */
const translit = requiredTranslitField;

const translatedSentenceSchema = z.object({
  i: z.number().int().min(0),
  en: z.string().min(1),
  /**
   * Optional even where the language is transliterated, unlike everywhere else
   * in this directory.
   *
   * Elsewhere a missing transliteration means the model ignored the schema and
   * a retry is worth it. Here the unit is a batch of whole news sentences, and
   * failing the batch over one absent transliteration throws away four good
   * translations and burns every provider to re-ask for them. The English is
   * what the learner opened the sentence for; the transliteration is a bonus,
   * and the reader already renders nothing when it is absent.
   */
  translit: translit.optional(),
});

export const importTranslationSchema = z.object({
  titleEn: z.string().optional(),
  // Only meaningful alongside a title, so optional even where the language is
  // transliterated; the validator checks `titleEn` when a title was sent.
  titleTranslit: translit.optional(),
  sentences: z.array(translatedSentenceSchema),
  /**
   * Proper nouns the model saw. A caseless script has no way to guess these
   * from the text alone, and without them every name in an article is offered
   * to the learner as new vocabulary.
   */
  names: z.array(z.string()).default([]),
});

export type ImportTranslation = z.infer<typeof importTranslationSchema>;

function buildPrompt(input: { sentences: string[]; title?: string }): string {
  const numbered = input.sentences.map((s, i) => `${i}: ${s}`).join("\n");
  const titleBlock = input.title ? `TITLE: ${input.title}\n\n` : "";
  const titleAsk = input.title
    ? `Also translate the title into "titleEn"${TRANSLITERATED ? ' and transliterate it into "titleTranslit"' : ""}.\n`
    : "";
  const translitKey = TRANSLITERATED ? `, "translit": "..."` : "";
  const titleKeys = input.title
    ? `"titleEn": "..."${TRANSLITERATED ? `, "titleTranslit": "..."` : ""}, `
    : "";

  return `You are ${profile.prompts.teacher}, helping a learner read an article they brought in themselves.
${profile.prompts.orthography}

Below are numbered ${LANGUAGE_NAME} sentences from that article.

${titleBlock}${numbered}

Translate each numbered sentence into natural English.
- Return one entry per sentence, with the SAME number it was given.
- Do not merge, split, reorder, summarise or skip any sentence.
- Do not simplify: this is real writing and the learner wants what it says.
- Do not return the ${LANGUAGE_NAME} text back.
${TRANSLIT_INSTRUCTION}
${titleAsk}Also list in "names" any proper nouns - people, places, organisations - that appear in these sentences, written exactly as they appear.

Return ONLY JSON matching this exact shape:
{ ${titleKeys}"sentences": [ {"i": 0, "en": "..."${translitKey}} ], "names": ["..."] }`;
}

/**
 * Translate a numbered span of sentences.
 *
 * `expected` is the count the caller asked for; the validator insists on
 * exactly the indices `0..expected-1`, once each. This is the check that
 * matters: a model that renumbers, drops or duplicates a sentence would
 * otherwise misalign every English line against the wrong target sentence -
 * silently, and for the whole rest of the article.
 */
export async function translateImportSpan(input: {
  sentences: string[];
  title?: string;
  deadline?: number;
}): Promise<ImportTranslation> {
  const expected = input.sentences.length;

  return completeJson(buildPrompt(input), {
    temperature: 0.2,
    deadline: input.deadline,
    validate: (raw) => {
      const data = importTranslationSchema.parse(JSON.parse(raw));
      const seen = new Set<number>();
      for (const s of data.sentences) {
        if (s.i >= expected) throw new Error(`Translation returned index ${s.i}, only 0..${expected - 1} were sent`);
        if (seen.has(s.i)) throw new Error(`Translation returned index ${s.i} twice`);
        seen.add(s.i);
      }
      if (seen.size !== expected) {
        throw new Error(`Translation returned ${seen.size} of ${expected} sentences`);
      }
      for (const s of data.sentences) {
        // A model that echoes the source back instead of translating it is a
        // real failure mode on long RTL input, and one that would otherwise be
        // stored as the "English" and read as gibberish forever.
        if (s.en.trim() === input.sentences[s.i].trim()) {
          throw new Error(`Translation returned sentence ${s.i} untranslated`);
        }
      }
      if (input.title && !data.titleEn) {
        throw new Error("Translation returned no title");
      }
      return data;
    },
  });
}
