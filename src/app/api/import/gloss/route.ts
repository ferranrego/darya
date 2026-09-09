import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { glossWord, lemmaMatchesSurface } from "@/lib/ai/gloss-word";
import { glossFailure } from "@/lib/ai/import-failure";
import { deadlineIn } from "@/lib/ai/providers";
import { lexiconIndex } from "@/lib/content/load";
import {
  addUserLexemeVariants,
  asLexiconEntry,
  findUserLexeme,
  insertUserLexeme,
} from "@/lib/db/user-lexemes";
import { matchKey, normalize } from "@/lib/text";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 30;
export const runtime = "nodejs";

/**
 * Look up a word from an imported article and, if it is real vocabulary, add it
 * to the learner's own dictionary.
 *
 * This is the only place in the app that creates a dictionary entry at runtime,
 * which is why so much of it is refusal. CLAUDE.md's rule for authored content
 * applies unchanged here: a wrong entry is worse than a missing one, so a
 * candidate that fails any check is dropped rather than patched, and the
 * learner is told the lookup failed.
 *
 * Cost: one model call per genuinely new word. None for a later inflection of
 * the same word - the entry goes into the learner's index, which gives it the
 * language's morphology, and none for a word the shipped lexicon already has.
 */

const BUDGET_MS = 20_000;

export async function POST(req: Request) {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let surface: string;
  let sentence: string;
  let sourceTextId: string | null = null;
  try {
    const body = await req.json();
    surface = String(body.surface).trim();
    sentence = String(body.sentence ?? "").trim();
    if (body.textId) sourceTextId = String(body.textId);
    if (!surface || surface.length > 80) throw new Error("bad surface");
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // 1. The shipped lexicon first, always. The tokenizer and the morphology
  //    engine miss real entries often enough - unusual inflections, ZWNJ
  //    variants - that without this the personal dictionary fills up with
  //    duplicates of curated words, each one a worse version of the original.
  const shipped = lexiconIndex().resolve(surface);
  if (shipped) {
    return NextResponse.json({ kind: "lexeme", lexemeId: shipped.id });
  }

  // 2. Already looked up. Costs nothing.
  const surfaceKey = matchKey(surface);
  const existing = await findUserLexeme(db, user.id, normalize(surface));
  if (existing) {
    return NextResponse.json({ kind: "personal", lexemeId: existing.id, entry: asLexiconEntry(existing) });
  }

  let gloss;
  try {
    gloss = await glossWord({ surface, sentence, deadline: deadlineIn(BUDGET_MS) });
  } catch (e) {
    console.error("Word gloss failed:", e);
    const failure = glossFailure(e);
    return NextResponse.json(
      { error: failure.message, reason: failure.reason },
      { status: failure.status },
    );
  }

  // 3. A word that exists ONLY as a name is not vocabulary: no entry, no SRS
  //    row - a learner should not be made to review the name of a minister.
  //
  //    A word that is merely being *used* in a name here is a different case
  //    and deliberately falls through: the middle word of a personal name is
  //    very often an ordinary noun, and its ordinary meaning is exactly what
  //    the learner tapped it to find out. They get the entry, plus a note that
  //    it is part of a name in this sentence.
  if (gloss.isOnlyName) {
    return NextResponse.json({ kind: "name" });
  }

  // 4. The model was asked about one word and sometimes answers about another,
  //    more familiar one. Reject a lemma that cannot plausibly be this word.
  const lemma = normalize(gloss.lemma.trim());
  if (!lemmaMatchesSurface(matchKey(lemma), surfaceKey)) {
    console.warn(`Gloss for "${surface}" came back as an unrelated lemma "${lemma}"`);
    return NextResponse.json(
      {
        error: "Couldn't pin down what this word means here.",
        reason: "invalid",
      },
      { status: 422 },
    );
  }

  // 5. The lemma itself may be in the lexicon even when the tapped form was not
  //    - which means the morphology missed it, not that the word is new.
  const lemmaEntry = lexiconIndex().resolve(lemma);
  if (lemmaEntry) {
    return NextResponse.json({ kind: "lexeme", lexemeId: lemmaEntry.id });
  }

  // A second learner may have raced us to the same word.
  const raced = await findUserLexeme(db, user.id, lemma);
  if (raced) {
    const variants = [...new Set([...raced.variants, surface])];
    if (variants.length !== raced.variants.length) {
      await addUserLexemeVariants(db, raced.id, variants);
    }
    return NextResponse.json({
      kind: "personal",
      lexemeId: raced.id,
      entry: asLexiconEntry(raced),
      usedAsName: gloss.usedAsName,
    });
  }

  const row = {
    // Random, never derived from the word: ids are permanent and referenced by
    // user_words, so they must not collide across learners or re-derive.
    id: `ux-${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    user_id: user.id,
    target: lemma,
    target_normalized: lemma,
    translit: gloss.translit ?? null,
    gloss_en: gloss.glossEn,
    pos: gloss.pos,
    present_stem: gloss.presentStem ?? null,
    // The tapped form is recorded so it resolves next time even if the
    // morphology would not have generated it.
    variants: surface === lemma ? [] : [surface],
    example_target: sentence || null,
    example_translit: null,
    example_en: gloss.exampleEn ?? null,
    source_text_id: sourceTextId,
  };

  try {
    await insertUserLexeme(db, row);
  } catch (e) {
    console.error("Personal lexeme insert failed:", e);
    return NextResponse.json(
      { error: "Looked the word up, but couldn't save it.", reason: "failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    kind: "personal",
    lexemeId: row.id,
    entry: asLexiconEntry({ ...row, created_at: "", updated_at: "" }),
    usedAsName: gloss.usedAsName,
  });
}
