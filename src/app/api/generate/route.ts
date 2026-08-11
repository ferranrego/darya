import { NextResponse } from "next/server";
import { generateText, vocabHash } from "@/lib/ai/generate";
import { lexicon, levelById, levels } from "@/lib/content/load";
import { levelVocabulary } from "@/lib/content/level-vocabulary";
import { scheduleFor, type Slot } from "@/lib/content/schedule";
import { scenesFor, type Scene } from "@/lib/content/scene";
import { beginnerPositionFor, knownSetsFor } from "@/lib/content/text-pool";
import { isTeachable } from "@/lib/content/teachability";
import {
  coldStartKnown,
  isBeginnerLevel,
  selectKnown,
  selectTargets,
  targetCountFor,
  teachablePool,
} from "@/lib/content/word-selection";
import { insertGeneratedText } from "@/lib/db/texts";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Scene ids handed out recently, per level, so a learner reading several
 * texts in a row at the same level doesn't get the same scene back to back.
 * In-memory only (per serverless instance, so it resets on cold start) - the
 * freshness check this replaces compared the LLM-authored title
 * (`langProfile.frames.titleFor`) against `avoidTitles`, but that filler is
 * gone (see `ai/generate.ts`) and there is no title to compute for a scene
 * without a model call, so this tracks scene ids directly instead.
 */
const recentSceneIdsByLevel = new Map<string, string[]>();

/** The themes the reader can ask for. Also the allow-list for the request body. */
const THEMES = [
  "Daily Life",
  "Food",
  "Travel",
  "Work",
  "Folktales",
  "Family",
  "Shopping",
  "Friendship",
] as const;

/**
 * Ensure the signed-in user has at least `want` unread texts at their level.
 * Generates (and caches, shared across users) only when the pool runs dry.
 */
export async function POST(req: Request) {
  let theme: string | undefined;
  let force = false;
  try {
    const body = await req.json();
    // The theme is interpolated straight into the prompt and then stored on a
    // row other learners read, so it is checked against the list the UI can
    // actually send rather than trusted. Unvalidated, one request could carry
    // an arbitrarily long string into three model calls and exhaust the shared
    // free-tier quota for every user of the deployment.
    if (typeof body?.theme === "string" && THEMES.includes(body.theme)) theme = body.theme;
    force = body?.force === true;
  } catch {
    // A malformed body is not worth failing on; the defaults below apply.
  }

  // No theme means "surprise me", so pick one rather than leaving it open.
  theme ??= THEMES[Math.floor(Math.random() * THEMES.length)];

  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: profile }, { data: words }, { data: readRows }] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).single(),
    db.from("user_words").select("lexeme_id,status,due").eq("user_id", user.id),
    db.from("user_texts").select("text_id").eq("user_id", user.id),
  ]);
  if (!profile) return NextResponse.json({ error: "no profile" }, { status: 400 });

  const level = levelById(profile.level_estimate);
  const readIds = new Set((readRows ?? []).map((r) => r.text_id));

  const { data: pool } = await db.from("texts").select("id, theme, doc").eq("level", level.id);
  const unread = (pool ?? []).filter((t) => !readIds.has(t.id));

  let slot: Slot | undefined;
  if (isBeginnerLevel(level)) {
    const levelIdx = levels.findIndex((candidate) => candidate.id === level.id);
    const previousLevel = levelIdx > 0 ? levels[levelIdx - 1] : null;
    const position = beginnerPositionFor(pool ?? [], readIds);
    slot = scheduleFor(level, previousLevel, lexicon.entries, isTeachable).find((candidate) => candidate.seq === position);
  }

  if (slot && !force) {
    const existingAtSlot = (pool ?? []).some(
      (text) => (text.doc as { seq?: number } | null)?.seq === slot.seq,
    );
    if (existingAtSlot) return NextResponse.json({ created: false, unread: 1 });
  } else if (!slot && !force) {
    // `theme` is always set by this point, so there is no unthemed branch.
    const unreadThemed = unread.filter((t) => t.theme === theme);
    if (unreadThemed.length > 0) {
      return NextResponse.json({ created: false, unread: unreadThemed.length });
    }
  }

  // Build the vocabulary constraint the same way the reader measures a text
  // against it - both sides now call `knownSetsFor`, the single definition of
  // what a placement credits a learner with. Reading the threshold off the
  // level below an L2 learner instead of their own used to credit them with
  // L1's entry figure - zero - leaving the reader with nothing it would show
  // at every level; and this route's own cold-start fallback used to be a
  // different list than the one the reader recognised as known, so a chunk of
  // the words a fresh text was written from scored as untaught on the other
  // side of the contract. `knownSetsFor`'s `coverage` folds in the level's
  // whole curriculum vocabulary unconditionally, so both halves agree by
  // construction rather than by two thresholds staying in sync by hand.
  const trackedIds = (words ?? [])
    .filter((w) => w.status === "known" || w.status === "learning")
    .map((w) => w.lexeme_id);
  const known = knownSetsFor({ level, entries: lexicon.entries, isUsable: isTeachable, trackedIds });

  const knownWords = lexicon.entries.filter((e) => known.familiar.has(e.id));
  // In-band by frequency, plus the curated beginner core at the first levels.
  // An entry whose gloss is "[C2 auto-fill]" is excluded either way: it can be
  // read but not taught, since the prompt would ask for it by that name and the
  // review card would answer with it.
  const candidates = teachablePool(
    lexicon.entries,
    level,
    (e) => known.familiar.has(e.id),
    isTeachable,
  );

  const ratio = profile.new_word_ratio ?? 0.05;
  const targetWords = selectTargets({
    candidates,
    count: targetCountFor(level, ratio),
    preferBeginnerCore: isBeginnerLevel(level),
  });

  // PEDAGOGY.md §7: due words are *known* - this only changes which known
  // words the text reuses (weighted to the front, via `selectKnown`), not
  // what it teaches. "Due" means a `learning` row whose `due` timestamp has
  // actually passed, not merely `status === "learning"`: this used to select
  // every learning word regardless of its `due` date, so a word reviewed five
  // minutes ago was rehearsed exactly as eagerly as one overdue by a month.
  const now = Date.now();
  const dueIds = new Set(
    (words ?? [])
      .filter((w) => w.status === "learning" && w.due != null && new Date(w.due).getTime() <= now)
      .map((w) => w.lexeme_id),
  );

  const avoidTitles = (pool ?? [])
    .map((t) => (t.doc as { titleEn?: string } | null)?.titleEn)
    .filter((t): t is string => !!t)
    .slice(-8);

  // A scene, at the levels that have one - see `content/scene.ts`. Picked
  // independently of `theme`: the UI's eight theme labels ("Shopping",
  // "Folktales"...) predate scenes and do not correspond to
  // `beginner-spec.json`'s 18 fields, so lining them up is future work.
  // Below, when one is selected, its vocabulary replaces the frequency slice
  // for both `knownWords` and `targetWords` - a scene is coherent by
  // construction, where the frequency slice is whichever words happen to
  // rank highest with no guarantee they share a topic.
  //
  // Sequenced, not random: `scenesFor` yields scenes in `beginner-spec.json`'s
  // own field order (Family, Body, Food, Home, ...), and a new learner's Nth
  // text at this level picks the Nth scene in that order, wrapping once every
  // field has been used. A random draw can repeat "Food & Drink" three times
  // before ever reaching "Nature & Environment"; walking the list in order is
  // what actually guarantees the learner meets their whole level's lexicon
  // rather than whichever few fields the dice favoured. Skips forward past a
  // scene handed out too recently (`recentSceneIdsByLevel`) - the same
  // freshness rule an LLM-written text already gets from `avoidTitles`, but
  // keyed on the scene's own id rather than a model-authored title, since no
  // title exists for a scene without calling a model.
  let scene: Scene | undefined;
  if (isBeginnerLevel(level)) {
    const candidates = scenesFor(level, lexicon.entries, isTeachable);
    if (candidates.length > 0) {
      const readAtLevel = (pool ?? []).filter((t) => readIds.has(t.id)).length;
      const recentIds = new Set(recentSceneIdsByLevel.get(level.id) ?? []);
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[(readAtLevel + i) % candidates.length];
        if (!recentIds.has(candidate.id)) {
          scene = candidate;
          break;
        }
      }
      scene ??= candidates[readAtLevel % candidates.length];

      const history = [...(recentSceneIdsByLevel.get(level.id) ?? []), scene.id].slice(-8);
      recentSceneIdsByLevel.set(level.id, history);
    }
  }

  // `scene.words` is already drawn from `levelVocabulary(level) ∪
  // teachablePool(level)` (see `buildScene`), so splitting it by level
  // vocabulary membership is enough to recover which of its words this
  // learner already has and which are new - no re-filtering against the
  // learner's own `known.familiar` needed on the known side, since the level's
  // assumed-known vocabulary is the same set `finalKnownPool`'s fallback is built from.
  // Falls back to the frequency-based pools when no scene applies, or when
  // the scene has nothing left to teach this learner (rare - `buildScene`
  // already requires 25-45 reachable words, but not guaranteed unteachable-free).
  let finalTargetWords = targetWords;
  let finalKnownPool = knownWords.length > 0 ? knownWords : coldStartKnown(lexicon.entries, level, isTeachable);
  if (slot) {
    const byId = new Map(lexicon.entries.map((entry) => [entry.id, entry]));
    const slotTargets = slot.introduces.flatMap((id) => {
      const entry = byId.get(id);
      return entry ? [entry] : [];
    });
    const slotReuses = slot.reuses.flatMap((id) => {
      const entry = byId.get(id);
      return entry ? [entry] : [];
    });

    if (slotTargets.length > 0) finalTargetWords = slotTargets;
    const reuseIds = new Set(slotReuses.map((entry) => entry.id));
    finalKnownPool = [...slotReuses, ...finalKnownPool.filter((entry) => !reuseIds.has(entry.id))];

    if (slot.scene) {
      const matchingScene = scenesFor(level, lexicon.entries, isTeachable).find((candidate) => candidate.id === slot.scene);
      if (matchingScene) scene = matchingScene;
    }
  } else if (scene) {
    const levelVocabIds = new Set(levelVocabulary(level, lexicon.entries, isTeachable).map((e) => e.id));
    const sceneKnown = scene.words.filter((e) => levelVocabIds.has(e.id));
    const sceneTeachable = scene.words.filter((e) => !known.familiar.has(e.id));
    const sceneTargets = selectTargets({
      candidates: sceneTeachable,
      count: targetCountFor(level, ratio),
      preferBeginnerCore: isBeginnerLevel(level),
    });
    if (sceneTargets.length > 0) finalTargetWords = sceneTargets;
    if (sceneKnown.length > 0) finalKnownPool = sceneKnown;
  }

  if (finalTargetWords.length === 0) {
    return NextResponse.json({ error: "no teachable words left at this level" }, { status: 409 });
  }

  try {
    const doc = await generateText({
      level,
      knownWords: selectKnown({ known: finalKnownPool, level, dueIds }),
      knownIds: known.coverage,
      targetWords: finalTargetWords,
      newWordRatio: ratio,
      theme,
      scene,
      // What this level already has, so the pool stops converging on the same
      // few stories.
      avoidTitles,
    });
    // A text that teaches nothing is one the pool will reject on every future
    // visit, so caching it means the learner asks for another one forever and
    // each attempt leaves another unusable row behind. `generateText` already
    // refuses to return one, so this is a belt-and-braces guard on the cache.
    const finalDoc = slot ? { ...doc, seq: slot.seq } : doc;
    if (finalDoc.newWords.length === 0) {
      return NextResponse.json({ error: "generated text teaches nothing" }, { status: 502 });
    }
    await insertGeneratedText(supabaseService(), finalDoc, vocabHash(finalDoc), theme);
    return NextResponse.json({ created: true, id: finalDoc.id });
  } catch (e: unknown) {
    // Logged in full, reported in brief: the message can carry provider names,
    // model ids and a slice of the upstream response body, and the reader
    // renders it verbatim to the learner.
    console.error("API /generate error:", e);
    return NextResponse.json({ error: "Could not write a new text right now." }, { status: 502 });
  }
}
