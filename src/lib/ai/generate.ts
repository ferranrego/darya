import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { CONTENT_FORMAT_VERSION, type LexiconEntry, type Level, type TextDocument } from "../content/schema";
import { buildIndex } from "../text";
import { lexicon } from "../content/load";
import { tokenize } from "../text";
import { completeJson, deadlineIn } from "./providers";
import { profile } from "../lang/index.ts";
import { TRANSLITERATED, translitField, wordList } from "./lang-format.ts";
import { MAX_OOV_TOKEN_RATE, MAX_OOV_TYPE_RATE } from "../content/difficulty.ts";

/**
 * AI text generation: one entry point over the shared free-tier provider
 * chain (see ./providers), strict validation, and a vocabulary verifier.
 * Callers cache results in Postgres, so this module never bills.
 *
 * Transliteration handling and vocabulary rendering live in ./lang-format,
 * shared with every other prompt in this directory.
 */

const outputSchema = z.object({
  titleTarget: z.string().min(1),
  titleTranslit: translitField,
  titleEn: z.string().min(1),
  sentences: z
    .array(
      z.object({
        target: z.string().min(1),
        translit: translitField,
        en: z.string().min(1),
      }),
    )
    .min(2),
});

type RawText = z.infer<typeof outputSchema>;

export interface GenerationRequest {
  level: Level;
  /**
   * The known words *shown to the model* - a prompt slice, capped by budget.
   *
   * Not the same thing as what the learner knows, which is why `knownIds`
   * exists separately.
   */
  knownWords: LexiconEntry[];
  /**
   * Every lexeme the learner knows, used only to *measure* the result.
   *
   * These were once the same set, and conflating them made the coverage gate
   * meaningless. The prompt slice is a few hundred words; a B2 learner knows
   * several thousand. Measuring the text against the slice counted every
   * legitimate word the learner knew but that did not fit the prompt as
   * out-of-vocabulary, so the 5% gate was being applied to a vocabulary five
   * times smaller than the learner's - failing good texts, and triggering
   * repairs that made them worse.
   */
  knownIds: ReadonlySet<string>;
  /** New words the text should introduce. */
  targetWords: LexiconEntry[];
  newWordRatio: number;
  theme?: string;
}

function buildPrompt(req: GenerationRequest): string {
  const known = wordList(req.knownWords);
  const target = wordList(req.targetWords, true);
  const [minS, maxS] = req.level.sentenceRange;
  const themeInstructions = req.theme ? `\n- Set the text in this scenario/theme where it fits naturally: ${req.theme}` : "";
  const beginnerInstructions = req.level.id === "L1" || req.level.id === "L2"
    ? `\n- Keep it highly practical for a beginner. Focus on everyday conversational phrases (e.g. 'How are you?', ordering food), W-questions, numbers, days of the week, and basic adjectives.`
    : "";

  return `You are ${profile.prompts.teacher} writing a graded reader text.
${profile.prompts.orthography}

Write a short, warm, concrete text (${minS}-${maxS} sentences, ${req.level.sentenceLengthHint}) about ${profile.prompts.culturalSetting}.
CRITICAL NARRATIVE RULES:
- The text must tell a coherent story or explain something clearly.
- Every sentence MUST be a logical continuation of the previous one. 
- Ensure a natural flow that makes sense to the reader; do NOT just write a list of disconnected sentences.${themeInstructions}${beginnerInstructions}

STRICT VOCABULARY CONSTRAINT:
- You may ONLY use these words the learner already knows (any inflection of them is fine): ${known}
- You MUST naturally weave in ALL of these new words: ${target}
- Do not use any other content words. Proper names of people are allowed sparingly.

Grammar allowed at this level: ${req.level.grammarAllowed.join("; ")}.


Return ONLY JSON with this exact shape:
${
  TRANSLITERATED
    ? '{"titleTarget": "...", "titleTranslit": "...", "titleEn": "...", "sentences": [{"target": "...", "translit": "...", "en": "..."}]}'
    : '{"titleTarget": "...", "titleEn": "...", "sentences": [{"target": "...", "en": "..."}]}'
}`;
}

// ---------------------------------------------------------------------------
// Verification + assembly
// ---------------------------------------------------------------------------

const index = buildIndex(lexicon.entries);

function assemble(raw: RawText, req: GenerationRequest, model: string): { doc: TextDocument; oovRate: number } {
  const targetIds = new Set(req.targetWords.map((w) => w.id));
  // Measured against everything the learner knows, plus what this text is
  // teaching - NOT against the prompt slice. See `knownIds` on GenerationRequest.
  const allowed = new Set<string>([...req.knownIds, ...targetIds]);
  const vocab = new Set<string>();
  const taught = new Set<string>();
  let oov = 0;
  let total = 0;

  const sentences = raw.sentences.map((s) => {
    const tokens = tokenize(s.target).map((surface) => {
      total++;
      const entry = index.resolve(surface);
      if (entry) {
        vocab.add(entry.id);
        if (targetIds.has(entry.id)) taught.add(entry.id);
      }
      if (!entry || !allowed.has(entry.id)) oov++;

      return { surface, lexemeId: entry?.id ?? null };
    });
    return { target: s.target, translit: TRANSLITERATED ? s.translit : undefined, en: s.en, tokens };
  });

  const oovRate = total > 0 ? oov / total : 1;
  const hash = createHash("sha256")
    .update([...vocab].sort().join(","))
    .digest("hex")
    .slice(0, 16);

  return {
    doc: {
      id: `tx-gen-${hash}-${randomUUID().slice(0, 8)}`,
      formatVersion: CONTENT_FORMAT_VERSION,
      level: req.level.id,
      titleTarget: raw.titleTarget,
      titleTranslit: TRANSLITERATED ? raw.titleTranslit : undefined,
      titleEn: raw.titleEn,
      sentences,
      vocabUsed: [...vocab].sort(),
      // Only the targets the text actually contains. Asking for eight and
      // delivering none was invisible before this was recorded.
      newWords: [...taught].sort(),
      newWordRatio: req.newWordRatio,
      source: "generated",
      model,
      createdAt: new Date().toISOString(),
    },
    oovRate,
  };
}

export function vocabHash(doc: TextDocument): string {
  return createHash("sha256").update(doc.vocabUsed.join(",")).digest("hex").slice(0, 16);
}

export async function repairText(
  doc: TextDocument,
  req: GenerationRequest,
  strict = true,
  deadline?: number,
): Promise<{ doc: TextDocument; oovRate: number }> {
  const allowed = new Set<string>([...req.knownIds, ...req.targetWords.map((w) => w.id)]);

  const badSentenceIndices: number[] = [];
  doc.sentences.forEach((s, idx) => {
    const hasOov = s.tokens.some((t) => !t.lexemeId || !allowed.has(t.lexemeId));
    if (hasOov) badSentenceIndices.push(idx);
  });
  
  if (badSentenceIndices.length === 0) return { doc, oovRate: 0 };
  
  // A trimmed known list. The repair prompt names the exact words to replace,
  // so the model does not need the full vocabulary to find a substitute - and
  // repeating the whole list doubled the cost of every text that needed fixing.
  const known = wordList(req.knownWords.slice(0, 120));
  const target = wordList(req.targetWords, true);

  // Name the offending words. `assemble` already knows exactly which tokens
  // failed and used to discard that, leaving the model to guess which word in
  // the sentence was the problem - so it often rewrote the wrong one.
  const badSentencesText = badSentenceIndices
    .map((i) => {
      const offenders = doc.sentences[i].tokens
        .filter((t) => !t.lexemeId || !allowed.has(t.lexemeId))
        .map((t) => t.surface);
      const note = offenders.length ? `   [replace: ${offenders.join(", ")}]` : "";
      return `${i}: ${doc.sentences[i].target}${note}`;
    })
    .join("\n");

  const repairPrompt = `You are ${profile.prompts.teacher}. The following sentences have vocabulary that is too difficult for the student.
Rewrite ONLY these specific sentences, replacing the marked words with allowed ones. Keep the meaning as close to the original as possible, and keep each sentence a logical continuation of the one before it.

Grammar allowed at this level: ${req.level.grammarAllowed.join("; ")}.

ALLOWED WORDS:
${known}
${target}

SENTENCES TO REPAIR:
${badSentencesText}

Return JSON strictly in this format:
${
  TRANSLITERATED
    ? '{"repairs": [{"index": 0, "target": "...", "translit": "...", "en": "..."}]}'
    : '{"repairs": [{"index": 0, "target": "...", "en": "..."}]}'
}
where "index" is the number provided above for the sentence.`;

  const repairSchema = z.object({
    repairs: z.array(z.object({
      index: z.number(),
      target: z.string(),
      translit: z.string().optional(),
      en: z.string()
    }))
  });

  const repairs = await completeJson(repairPrompt, {
    temperature: 0.2,
    deadline,
    validate: (raw) => repairSchema.parse(JSON.parse(raw)).repairs
  });
  
  const raw: RawText = {
    titleTarget: doc.titleTarget,
    titleTranslit: doc.titleTranslit,
    titleEn: doc.titleEn,
    sentences: doc.sentences.map((s, i) => {
      const repair = repairs.find(r => r.index === i);
      return repair
        ? { target: repair.target, translit: repair.translit, en: repair.en }
        : { target: s.target, translit: s.translit, en: s.en };
    })
  };
  
  const { doc: finalDoc, oovRate } = assemble(raw, req, doc.model ?? "unknown-repair");
  if (strict && oovRate > MAX_OOV_TOKEN_RATE) {
    throw new Error(`Repair failed: OOV rate still ${(oovRate * 100).toFixed(0)}%`);
  }
  // The measured rate, not an assumption. A lenient repair returns whatever the
  // model produced, and reporting that as 0 let a text the reader will always
  // reject be written to the shared cache, where it counts as unread forever.
  return { doc: finalDoc, oovRate };
}

/**
 * How many of the requested new words a text must actually contain.
 *
 * A graded reader that introduces nothing is not a mild disappointment, it is a
 * text the pool will reject (`MIN_NEW_LEXEMES`), which empties the pool, which
 * makes the reader ask for another one. Measured before this contract existed,
 * Dari used 0 of 5 requested words at B2 and 0 of 7 at C1 - so every text at
 * those levels was unusable, and the reader regenerated forever.
 *
 * Currently all of them. That is a deliberate tightening, and it has a cost
 * worth knowing: at L1 a text is two or three sentences of at most six words
 * with no conjunctions, and only two target words, so failing to place one is
 * failing to place half - the generation then fails outright rather than
 * returning a text that teaches one new word. Measured: L1 failed all three
 * attempts with "teaches 1 of 2", while L7 and L8 comfortably reached 8 of 8.
 * If beginner levels keep failing, this is the number to revisit, not the
 * prompt.
 */
const MIN_TARGET_USE = 1.0;

function requiredTargets(req: GenerationRequest): number {
  if (req.targetWords.length === 0) return 0;
  return Math.max(1, Math.ceil(req.targetWords.length * MIN_TARGET_USE));
}

/**
 * Ask again for the words the text left out.
 *
 * Distinct from `repairText`, which fixes vocabulary that was too *hard*. This
 * fixes vocabulary that is *missing*, and the two need opposite instructions -
 * pointing the OOV repair at this problem asked the model to simplify a text
 * whose fault was that it was already too simple.
 */
async function addMissingTargets(
  doc: TextDocument,
  req: GenerationRequest,
  model: string,
  deadline?: number,
): Promise<{ doc: TextDocument; oovRate: number }> {
  const used = new Set(doc.newWords);
  const missing = req.targetWords.filter((w) => !used.has(w.id));

  const prompt = `You are ${profile.prompts.teacher}. This graded reader text is correct, but it fails to teach the words it was written for.

TEXT:
${doc.sentences.map((s, i) => `${i}: ${s.target}`).join("\n")}

These words MUST appear in the text and currently do not: ${wordList(missing, true)}

Rewrite the sentences that need to change so every missing word appears naturally, keeping the story, its length, and the rest of the vocabulary the same. Any inflection of a required word counts. Do not introduce any other unfamiliar word.

Grammar allowed at this level: ${req.level.grammarAllowed.join("; ")}.

Return JSON strictly in this format:
${
  TRANSLITERATED
    ? '{"repairs": [{"index": 0, "target": "...", "translit": "...", "en": "..."}]}'
    : '{"repairs": [{"index": 0, "target": "...", "en": "..."}]}'
}
where "index" is the number of the sentence above that you rewrote.`;

  const repairSchema = z.object({
    repairs: z.array(
      z.object({
        index: z.number(),
        target: z.string(),
        translit: z.string().optional(),
        en: z.string(),
      }),
    ),
  });

  const repairs = await completeJson(prompt, {
    temperature: 0.4,
    deadline,
    validate: (raw) => repairSchema.parse(JSON.parse(raw)).repairs,
  });

  const raw: RawText = {
    titleTarget: doc.titleTarget,
    titleTranslit: doc.titleTranslit,
    titleEn: doc.titleEn,
    sentences: doc.sentences.map((s, i) => {
      const repair = repairs.find((r) => r.index === i);
      return repair
        ? { target: repair.target, translit: repair.translit, en: repair.en }
        : { target: s.target, translit: s.translit, en: s.en };
    }),
  };
  return assemble(raw, req, model);
}

/**
 * Wall-clock budget for a whole generation, including repairs.
 *
 * The route is killed at 60s (`maxDuration`), and a killed function has spent
 * its tokens, cached nothing and returned a body the client cannot parse. This
 * leaves room to persist the result and answer properly.
 */
const GENERATION_BUDGET_MS = 45_000;

export async function generateText(req: GenerationRequest): Promise<TextDocument> {
  let lastError: unknown;
  const needed = requiredTargets(req);
  // One deadline for the run, not per call: an attempt is up to three
  // sequential completions, and three attempts of those against a per-call
  // budget is several times the route's whole allowance.
  const deadline = deadlineIn(GENERATION_BUDGET_MS);

  // Try up to 3 times to get a good text (including repairs)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let result = await completeJson(buildPrompt(req), {
        temperature: 0.8,
        deadline,
        validate: (raw, model) => {
          const parsed = outputSchema.parse(JSON.parse(raw));
          return assemble(parsed, req, model);
        },
      });

      if (result.oovRate > MAX_OOV_TOKEN_RATE) {
        const strict = attempt < 2; // Strict on attempts 0 and 1, lenient on attempt 2
        try {
          result = await repairText(result.doc, req, strict, deadline);
        } catch (repairError) {
          // If repair fails, we throw to trigger the outer generation retry
          throw new Error(
            `Repair failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`,
          );
        }
      }

      // The text is readable. Now check it actually teaches something.
      if (result.doc.newWords.length < needed) {
        const retried = await addMissingTargets(
          result.doc,
          req,
          result.doc.model ?? "unknown-repair",
          deadline,
        );
        // Only keep the rewrite if it helped and did not make the text harder.
        if (
          retried.doc.newWords.length > result.doc.newWords.length &&
          retried.oovRate <= MAX_OOV_TOKEN_RATE
        ) {
          result = retried;
        }
      }

      if (result.doc.newWords.length < needed) {
        throw new Error(
          `Text teaches ${result.doc.newWords.length} of ${req.targetWords.length} requested words, needs ${needed}`,
        );
      }

      // Last gate: would the reader show this? The caller writes what comes
      // back to a cache shared by every learner at this level, and a text the
      // pool rejects can never be deleted from there - it just keeps counting
      // as unread while never appearing, which is the stuck reader again. The
      // lenient third attempt is what makes this reachable: it returns whatever
      // the model produced, so its measured rate has to be checked here.
      const untaught = result.doc.vocabUsed.filter(
        (id) => !req.knownIds.has(id) && !result.doc.newWords.includes(id),
      );
      const typeRate = result.doc.vocabUsed.length
        ? untaught.length / result.doc.vocabUsed.length
        : 0;
      if (typeRate > MAX_OOV_TYPE_RATE) {
        throw new Error(
          `Text has ${(typeRate * 100).toFixed(0)}% untaught vocabulary; the reader would reject it`,
        );
      }

      return result.doc;
    } catch (e) {
      lastError = e;
      console.warn(`Generation attempt ${attempt + 1} failed:`, e);
      if (Date.now() >= deadline) break;
    }
  }

  throw lastError;
}
