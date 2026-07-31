# Pedagogy

The rules the product rests on, and the numbers that make them checkable. Every
one of these was learned from a defect that shipped, so each says what goes
wrong when it is violated, not only what it asserts.

If you change a number here, change it deliberately and say why. Several of
them look arbitrary and are not.

---

## 1. Reading only teaches above ~95% known words

A learner acquires vocabulary from reading when they already know almost every
running word, because that is what makes the unknown ones inferable from
context. The usual figures are 95% for assisted reading and 98% for pleasure
reading. Below that the learner is decoding, not acquiring, and **the failure is
silent**: the text looks fine and simply does not teach.

This is the single number the whole product rests on. It lives in
`src/lib/content/difficulty.ts`.

| constant | value | counts |
|---|---|---|
| `MAX_OOV_TOKEN_RATE` | 0.05 | **running words** - every occurrence. The rate the research is stated in, checked by the generator. |
| `MAX_OOV_TYPE_RATE` | 0.12 | **distinct lexemes** - a word counts once however often it appears. Checked by the reader when choosing a text. |
| `LEGACY_MAX_OOV_TYPE_RATE` | 0.25 | the old single threshold, applied only to texts cached before the two were separated. |

**The two rates are not interchangeable.** Known words repeat and new words
usually do not, so a given text's type rate is always the higher of the two.
Applying the token threshold to a type count rejects texts that are comfortably
readable, which empties the pool and leaves the reader on "Writing your next
text…" forever. That has happened.

Both were once a single `MAX_OOV_RATE = 0.25`, duplicated in two files. That is
wrong twice over: 25% unknown is far past the point where reading works, and the
two copies were not measuring the same thing.

## 2. A text that teaches nothing is worse than no text

A graded reader exists to introduce words. Measured before this was enforced,
Dari texts used **0 of 5** requested new words at B2 and **0 of 7** at C1. They
read perfectly well.

Two things then compound. The reader requires at least one new lexeme
(`MIN_NEW_LEXEMES`), so it rejects the text; the pool looks empty; the reader
asks the server for another one, forever, caching an unusable row each time.

So: the generator requires at least **half** the requested target words to
actually appear (`MIN_TARGET_USE`), retries with a prompt naming the missing
ones, and refuses to return a text that teaches nothing. The route refuses to
cache one. Half rather than all, because demanding all of them buys a contorted
sentence.

**Ask for fewer words.** The cap is 8 per text, down from 15. A text that
teaches four words well beats one listing fifteen, and at the higher levels the
model simply ignored the longer list.

## 3. Level thresholds come from research, not from file size

`entryKnownWords` is shown to the learner as their target. It must therefore
mean something about the CEFR level, not about this repository.

| CEFR | lemmas |
|---|---|
| A1 | 500 |
| A2 | 1,200 |
| A2+ | 1,700 |
| B1 | 2,500 |
| B2 | 4,000 |
| C1 | 6,000 |
| C2 | 8,000 |

Deriving these from the lexicon's frequency bands instead is **circular** - band
edges are an arbitrary fraction of however many words the file happens to
contain. It silently dropped Dari A1 from 500 words to 121, and the app told
learners they were four times closer to A1 than they were.

Direction: **CEFR target in, `freqBands` out.** `scripts/rederive-levels.ts`
does this and refuses to write a level that can teach nothing.
`src/lib/content/levels.test.ts` guards both directions.

Where a lexicon is too small for the real figure, the affected levels are
compressed evenly and reported as content-limited. Catalan's B2 currently sits
at 2,941 rather than 4,000 for this reason: **growing the lexicon is the fix,
not lowering the number.**

## 4. Frequency ordering is the highest-leverage curriculum decision

Teaching order, level thresholds and difficulty all rest on it, so it has to be
measured rather than assumed. It was not: ranks were the order words were typed
into a file, and Catalan's most common word was `català`. It is now `de`.

`scripts/build-frequency.ts` derives it from real corpora. Two things there are
deliberate:

- **Blend in log space, not rank space.** Ranks are Zipf-distributed, so the gap
  between 5 and 50 is a far bigger difference in real frequency than between
  3,000 and 3,045. A plain weighted sum treats them as equal and lets one bad
  source drag a word arbitrarily far down.
- **Dari's corpora are the wrong language.** No Afghan Dari corpus exists at
  usable scale, so the available text is Iranian Persian. For the vocabulary
  where the two varieties diverge that is not weak evidence, it is evidence
  about a different language: موتر ranks ~3,600th because Iranians say ماشین,
  and پوهنتون does not occur at all. The hand-authored Dari order is therefore
  weighted 0.75 and the corpora refine it. Catalan curation gets weight 0,
  because it carried no signal.

## 5. Balance the parts of speech, or you will only teach nouns

Both lexicons are roughly three-quarters nouns (ca 74%, prs 78%). A frequency
slice of unknown words is therefore almost all nouns **by construction** - the
measured new-word mix at Dari B2 was `noun:5`, at C1 `noun:7`.

That is not a stylistic complaint. Every level's `grammarAllowed` is mostly verb
morphology, and a reader that never introduces a verb cannot exercise any of it.

`selectTargets` caps nouns at ~55% and seeds one verb and one modifier first,
searching the whole candidate list rather than the frequent head - at the upper
levels the most frequent unknown words are *all* nouns, so a head-only search
finds no verb and the quota silently does nothing exactly where it is needed.

Quotas degrade rather than throw. A level whose remaining vocabulary genuinely
holds no verbs should still produce a text.

## 6. Words need to be met again

Incidental acquisition needs roughly 6-12 meaningful encounters. The reader
feeds the review queue; `selectKnown` weights words that are due back into the
text so the loop runs both ways. Due words are *known*, so this changes which
known words a text reuses, not what it teaches, and they never take more than
half the prompt slice.

## 7. Measurement set ≠ prompt slice

The clearest engineering consequence of the coverage rule, and the subtlest bug
in the pipeline.

- `knownWords` is what the model is **shown**. Capped, because it is context on
  a free tier and past a few hundred words the model stops reading it.
- `knownIds` is everything the learner knows, used only to **measure** the
  result.

Conflating them made the coverage gate meaningless: a B2 learner knows thousands
of words, so measuring against a few-hundred-word prompt slice counted every
legitimate word that did not fit as out-of-vocabulary. The 5% gate was applied
to a vocabulary five times too small, failing good texts and triggering repairs
that made them worse.

## 8. Language-specific traps

Neither language is a generic "target language", and the failure mode in both is
a fluent, confident, wrong sentence.

**Catalan** - the norm is the IEC (GIEC 2016, *Ortografia catalana* 2017,
DIEC2), central/Barcelona standard.
- Castilianisms are the highest-frequency defect: `tenir que` for `haver de`,
  `donar-se compte` for `adonar-se`, `hi han` for `hi ha`, Spanish-style
  personal *a*, `lo` as a neuter article.
- Teach the **periphrastic past** (`vaig menjar`), not the literary simple past
  (`mengí`) - every level says so, so the simple past must not appear in
  generated text or mined vocabulary.
- Post-2017 spellings only: `soc` not `sóc`, `dona` not `dóna`.
- Not Valencian or Balearic (`seua`, `este`).
- Verify paradigms, plurals in `-s/-ç/-x/-ig`, apostrophation and `l·l` against
  DIEC2 rather than from memory.

**Dari** - the norm is Kabul standard Afghan Persian.
- **Iranian forms taught as Dari is the defect the product cares most about**,
  and your training data is against you: Iranian Persian dominates the written
  record. سرک not خیابان, موتر not ماشین, پوهنتون not دانشگاه, شفاخانه not
  بیمارستان.
- The **majhul vowels** are the most Dari thing about Dari: `dōst` not `dust`,
  `shēr` not `shir`. The transliteration *is* the pronunciation guide, so
  erasing them teaches an Iranian accent. Check consistency across the whole
  file, not per entry.
- Present-tense formation needs `presentStem`, and Persian present stems are
  frequently irregular and **not derivable**. A guessed stem produces a form the
  learner will internalise as correct.

## 9. Prompts must not name a language

Enforced by `src/lib/ai/prompt-leak.test.ts`. Anything language-specific belongs
in `src/lib/lang/<code>/prompts.ts` and reaches the prompt through `profile`.

The Catalan build was asking a model to be "an expert Persian (Dari) linguist"
about Catalan sentences, and for text "100% natural and idiomatic in Dari".

## 10. Placement should not skew low

A learner placed below their level is shown texts they find trivial, and the
error is comfortable enough that nobody reports it. The band schedule is derived
from `FREQ_BAND_COUNT` rather than written out: a literal naming bands 11 and 12
in a ten-band lexicon silently dropped four questions *and* left the surviving
weights over-sampling band 1, skewing every estimate downward.

More samples at the common end is deliberate - that is where the level
boundaries are packed together, so that is where a wrong answer moves the
estimate most.
