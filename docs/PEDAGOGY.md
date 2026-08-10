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
`src/lib/content/difficulty.ts`, as `maxOovRateFor(level)` /
`maxOovTypeRateFor(level)` rather than a single constant - see the beginner
note below for why.

| function | non-beginner | pre-A1/A1 | counts |
|---|---|---|---|
| `maxOovRateFor` | 0.05 | 0.10 | **running words** - every occurrence. The rate the research is stated in, checked by the generator. |
| `maxOovTypeRateFor` | 0.12 | 0.25 | **distinct lexemes** - a word counts once however often it appears. Checked by the reader when choosing a text. |
| `LEGACY_MAX_OOV_TYPE_RATE` | 0.25 | 0.25 | the old single threshold, applied only to texts cached before the two were separated. |

**The two rates are not interchangeable.** Known words repeat and new words
usually do not, so a given text's type rate is always the higher of the two.
Applying the token threshold to a type count rejects texts that are comfortably
readable, which empties the pool and leaves the reader on "Writing your next
text…" forever. That has happened.

Both were once a single `MAX_OOV_RATE = 0.25`, duplicated in two files. That is
wrong twice over: 25% unknown is far past the point where reading works, and the
two copies were not measuring the same thing.

**Both rates are loosened for pre-A1/A1, and this is a real compromise, not a
research figure.** 95% coverage assumes a learner who already knows something to
be 95% of; a learner with zero tracked words cannot satisfy it against any text
at all, which is exactly the contract failure that used to strand the reader on
"Writing your next text…" forever at the very first level. The loosened rate
above is what every text at these levels is measured against - still tolerant
enough to admit texts a strict 95% would reject as unreadable at a level with
almost nothing assumed known. See §12: pre-A1/A1 is now an authored corpus, not
generated, so this gate applies to it only through `build-seed-texts.ts`'s own
resolution check (every word must resolve to a lexeme) rather than a measured
OOV rate - an authored text cannot contain an unknown word by construction, the
same property a frame filler once claimed and did not actually have.

## 2. A text that teaches nothing is worse than no text

A graded reader exists to introduce words. Measured before this was enforced,
Dari texts used **0 of 5** requested new words at B2 and **0 of 7** at C1. They
read perfectly well.

Two things then compound. The reader requires at least one new lexeme
(`MIN_NEW_LEXEMES`), so it rejects the text; the pool looks empty; the reader
asks the server for another one, forever, caching an unusable row each time.

So: the generator requires **every** requested target word to actually appear
(`MIN_TARGET_USE = 1.0` in `src/lib/ai/generate.ts`), retries with a prompt
naming the missing ones, and refuses to return a text that teaches nothing. The
route refuses to cache one. All rather than half, and this is deliberately
stricter than an earlier version of this document said: measured, L5 through L8
hit 8 of 8 comfortably, so the compromise the "half" figure was hedging against
did not actually cost anything at the levels that use the free-form path. The
one level where "all" is not reachable is L1, where a text is two or three
sentences of at most six words and only two target words are asked for - so
missing one is missing half, not a rounding error. `requiredTargets` relaxes the
bar by exactly one word on the last of the three attempts, for that case alone.
**This whole section is moot at pre-A1/A1**, which is authored, not generated
(see §12) - a hand-authored text either uses its assigned words or a
philologist notices and fixes it before it ships, so there is no "requested but
missing" case for a retry loop to catch.

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
compressed evenly and reported as content-limited. Catalan's C1 currently sits
at 4,203 rather than 6,000, and C2 at 4,406 rather than 8,000, for this reason:
**growing the lexicon is the fix, not lowering the number.** (Below C1, every
Catalan level hits its real published target - the 4,609-entry lexicon reaches
B2's 4,000 with no compression at all.)

`fitTargets`'s compression itself had a bug worth naming, because it is the
kind that looks correct in every unit test and only shows up against real data.
Interpolating linearly from the last uncompressed level's target to `ceiling`
across `remaining` compressed levels necessarily lands the *last* one exactly on
`ceiling`, by construction - `floor + step * remaining == ceiling`. For every
compressed level except the last that is fine; for the last it means the top
level's own `entryKnownWords` sits exactly at the top of everything the lexicon
has, leaving it nothing left to teach - the same dead end §2 exists to prevent,
reached through the level table instead of the generator. Measured before the
fix: Catalan's C1 and C2 were compressed into a **55-word** margin above B2 (band
9's own top sat at rank 4,055, a hair past B2's uncompressed 4,000), so three
consecutive CEFR levels shared what was functionally one teachable envelope.
Dividing by `remaining + 1` instead of `remaining` reserves one extra step of
headroom below `ceiling` for the true top level, the same way every other
compressed level already gets headroom below the one above it.

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

## 5. Frequency is not what a beginner needs first

Frequency decides teaching *order*. It does not decide what a learner needs on
day one, and no corpus will, because abstract nouns are far commoner in written
text than concrete ones. Catalan's L1 head is `estat, cosa, part, manera,
sistema`, while `poma` ranks 1468, `plat` 1161 and `carn` 818. Measured, 80 of
the 138 concrete beginner words in the lexicon ranked past L1, so *El gos menja
carn* and *Quant costa la poma?* could not be written at the level they belong
to.

The fix is additive and never touches `freqRank`: `content/<lang>/lexicon/
beginner-spec.json` states what beginner coverage *means*, and the
`beginner-core` tag is derived from it by `scripts/tag-beginner-core.ts`. The
tag makes a word **teachable early**; it does not make it count as known.

**Specify requirements, not a word list.** The first version was a list written
from memory, and measuring it showed exactly what that costs: every subject
pronoun, every possessive, every demonstrative, ten of twelve position words and
fifteen numbers were present in the lexicon and unreachable. A learner could not
say `jo`, `aquest`, `sota` or `tres` in their first week. A list cannot be
falsified; requirements can. Four kinds, because the vocabulary behaves
differently:

- **Closed classes** are finite, so completeness is checkable and any absence is
  a failure. There is no judgement in "a beginner needs `tu`".
- **Semantic fields** are open, so they declare a minimum and a seed.
- **Verb functions** specify verbs by what they let a learner *do*. This is what
  catches `pagar`, `esperar` and `ajudar` - words no frequency list puts near
  the top and every beginner needs in week one.
- **Descriptive dimensions** group adjectives by what they describe - size,
  build, age, temperature, price, taste, colour. This started as a list of
  antonym pairs and that list was missing `gras/prim` and `roig`, for the same
  reason the original list was missing pronouns. Enumerating the *dimensions* is
  a small, nearly closed problem; enumerating pairs from memory is not.

**The gate is a sentence, not a count.** `beginner-expressible.test.ts` holds
~65 canonical A1 sentences per language and asserts every token resolves to a
teachable, tagged entry. A word count said the 4,345-entry Catalan lexicon was
fine while a beginner could not write *el gat dorm sota la taula*. Only asking
"can this sentence be built?" said otherwise. It found, in one run: no Nature
field at all (`riu`, the user's own example), `fer` missing from every verb
function, no intensifiers, Dari's object marker `را` untagged, and `نوشیدن`
listed as a variant whose paradigm was never generated, so `می‌نوشم` glossed to
nothing.

**Predominance has to apply to both halves of the prompt.** Tagging only affects
what is *taught*. While the known-word slice was still ordered by raw corpus
frequency, the model was told to teach `poma` and `gos` and to build sentences
from `de, ser, el, la, que, estat, cosa, manera` - so the text stayed abstract
whatever was being taught. Both `selectKnown` and the cold-start fallback now
lead with the core.

**The core includes closed classes, so it cannot order teaching targets on its
own.** A beginner needs `el`, `de` and `amb`, but as the mortar of a sentence,
not as vocabulary cards. Ranking the whole core equally made pre-A1 teach
`ser, la, no, amb, es, què, pel`. Content words are preferred, and *inside* the
core the order is shuffled rather than frequency-ordered - sorting the core by
corpus frequency reaches `home, parlar, pensar, moment` and never `gos`, which
is the premise of the core restated as a bug.

**New words per sentence, revised down from an earlier figure in this
document.** `targetCountFor` gives beginner levels **one new word per
sentence, capped at 4** (`src/lib/content/word-selection.ts`), not the "two
per sentence, capped at ten" an earlier version of this section argued for.
The argument for *more* new words at A1 is still right in principle - *El gos
menja molta carn* teaching four concrete words at once is easier than a
sentence teaching one abstract one - but the number this document originally
proposed was never reachable in practice: `MIN_TARGET_USE = 1.0` (§2) requires
every requested word to actually land in a handful of six-word sentences with
no subordination, and asking for ten made that impossible before a single
sentence was written. The count that shipped is the one measured to actually
fit the form, not the one the research argument alone would prefer.
**At pre-A1/A1, this is the fallback path, not the primary one.** A learner
is served the authored corpus (§12) first - `text-pool.ts` puts seed texts
ahead of anything generated - and `targetCountFor`'s beginner case only
governs live generation once that corpus runs dry for a given learner
(currently 15-20 texts per language, split L1/L2; §12 covers what still needs
authoring to reach full coverage). When it does apply, it now draws its
vocabulary from a selected `Scene` rather than the raw frequency slice (see
`src/app/api/generate/route.ts`) - coherent by construction the same way the
authored corpus is, just generated instead of reviewed.

## 6. Balance the parts of speech, or you will only teach nouns

Both lexicons are roughly three-quarters nouns (ca 74%, prs 78%). A frequency
slice of unknown words is therefore almost all nouns **by construction** - the
measured new-word mix at Dari B2 was `noun:5`, at C1 `noun:7`.

That is not a stylistic complaint. Every level's `grammarAllowed` is mostly verb
morphology, and a reader that never introduces a verb cannot exercise any of it.

`selectTargets` caps nouns at ~55% and seeds one verb and one modifier first,
searching the whole candidate list rather than the frequent head - at the upper
levels the most frequent unknown words are *all* nouns, so a head-only search
finds no verb and the quota silently does nothing exactly where it is needed.

**The cap runs both directions.** A candidate pool can be verb-heavy instead of
noun-heavy, and for a while nothing capped that direction either. Measured live:
correcting Dari C1's `entryKnownWords` to the vocabulary the lexicon actually
supports (§3) shrank its candidate pool to the tail of the lexicon, which turned
out to hold 88 verbs against 65 nouns and zero adjectives or adverbs - a small
pool where rare, specialised verbs happen to cluster. Without a matching
`MAX_VERB_SHARE`, `selectTargets` could return eight verb conjugations and no
concrete vocabulary to hang them on: the "nine nouns in a row" failure this
section exists to prevent, with the part of speech swapped. Capped at the same
~55% as nouns, by the same degrade-rather-than-throw rule below.

Quotas degrade rather than throw. A level whose remaining vocabulary genuinely
holds no verbs (or no nouns) should still produce a text.

## 7. Words need to be met again

Incidental acquisition needs roughly 6-12 meaningful encounters. The reader
feeds the review queue; `selectKnown` weights words that are due back into the
text so the loop runs both ways. Due words are *known*, so this changes which
known words a text reuses, not what it teaches, and they never take more than
half the prompt slice.

## 8. Measurement set ≠ prompt slice

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

## 9. Language-specific traps

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

## 10. Prompts must not name a language

Enforced by `src/lib/ai/prompt-leak.test.ts`. Anything language-specific belongs
in `src/lib/lang/<code>/prompts.ts` and reaches the prompt through `profile`.

The Catalan build was asking a model to be "an expert Persian (Dari) linguist"
about Catalan sentences, and for text "100% natural and idiomatic in Dari".

**The test only catches a language being named, not a language leaking in.**
The shared beginner-level prompt in `ai/generate.ts` once hardcoded the Catalan
conjunctions `i, però, perquè, després` and the pronouns `ell, ella` as worked
examples, and the Catalan-only grammar checker hardcoded a Catalan personal-*a*
example - both shipped straight into the Dari build, and `prompt-leak.test.ts`
found nothing wrong because neither snippet names a language, it just *is* one.
Fixed by moving the example words out of the shared template entirely: the
conjunction rule now lives in each level's own `sentenceLengthHint`, stated in
that language's own words, and the shared prompt only ever refers to it by
reference. The lesson generalises past this one instance: a leak-detector that
matches language *names* cannot catch language *content*, and the fix for that
is architectural (nothing language-specific in the shared file to leak) rather
than a longer blocklist.

## 11. Placement should not skew low

A learner placed below their level is shown texts they find trivial, and the
error is comfortable enough that nobody reports it. The band schedule is derived
from `FREQ_BAND_COUNT` rather than written out: a literal naming bands 11 and 12
in a ten-band lexicon silently dropped four questions *and* left the surviving
weights over-sampling band 1, skewing every estimate downward.

More samples at the common end is deliberate - that is where the level
boundaries are packed together, so that is where a wrong answer moves the
estimate most.

## 12. Author the beginner corpus; generate only above it

Pre-A1/A1 was generated by a deterministic sentence-frame engine for one
release. It shipped this:

> دریا گرم است. — The river is warm, hot.
> گل من سرد است. — My flower is cold.
> من یک زمین دارم. — I have a land, ground, earth.

Grammatical, meaningless, and reproducible byte-for-byte from committed data -
no model call, no bad luck. **Selectional restrictions are lexical, not
categorical.** *Cold* applies to weather, water, tea, hands, rooms, nights -
not flowers, trees or land. No semantic field contains exactly that set; it
can only be enumerated per word, and enumerating which adjective may modify
which noun *is* authoring, at which point the frame machinery had bought
nothing. Measured on the shipped content: 16 of 18 scene recipes hit a
multi-sense gloss (`glossEn`, a dictionary entry like "land, ground, earth")
inside their first four nouns, 13 of 18 inside the first two - so the title
too - and in the vocabulary a frame could reach, roughly 30% of entries had a
multi-sense gloss against 4-10% corpus-wide. That output was the median of
the design, not an unlucky tail, and it is why frames were removed rather
than tuned - `src/lib/content/frames.ts` and `src/lib/lang/<code>/frames.ts`
no longer exist.

**Generation is hardest exactly where vocabulary is tightest** (pre-A1, a few
hundred usable words) **and easiest where it is loosest** (B2+, where a
natural sentence is already in-vocabulary). So: author where generation is
hard, generate where it is easy. Pre-A1/A1 is now a hand-authored, reviewed
corpus - `scripts/data/seed-texts-<lang>.ts` → `build-seed-texts.ts`, which
tokenizes every sentence against the lexicon and fails the build on any
unresolvable word, the strongest gate in the repo. `text-pool.ts` serves seed
texts ahead of anything generated and in curriculum order (`seq`). A2 and
above is unchanged: free-form LLM generation, measured by §1's coverage gate
and §2's `MIN_TARGET_USE` like every other level - there is no separate,
weaker path for it to fall back to anymore, and no `oovRate: 0` shortcut.

**The curriculum, not just the sentences, is authored data now.**
`src/lib/content/schedule.ts` turns a level's new vocabulary into an ordered
sequence of `Slot`s - which words a text should introduce, grouped by the
`beginner-spec.json` semantic field they belong to, and which recent words it
should reuse (PEDAGOGY §7's 6-12 encounters, spent across slots rather than
within one). `scripts/author-texts.live.test.ts` drafts offline against this
schedule: eight candidates per slot, each scored against `text-checks.ts`'s
gates (coverage, teaching, gloss, interference, cohesion, shape), the best
kept and staged to a review file - never written directly into
`seed-texts-<lang>.ts`. A philologist reviews the staged batch
(`review-batch.ts --texts`) before anything merges, one batch at a time
(CLAUDE.md: "running three batches back to back put 142 entries into a single
review, which is not a review"). This is slower than a frame filler and
correct in a way a frame filler could not be even in principle: an author (a
model under review, or a person) can judge whether a sentence is true and
natural, and no categorical rule over word classes can.

**The scene taxonomy only covers the beginner core, and that is a real, open
limit, not an oversight to paper over.** `beginner-spec.json`'s semantic
fields are seed lists sized to size the beginner-core tag - nothing above it
is tagged into any field, verb function or dimension, in either language.
Measured: `schedule.ts`'s L1 schedule is 0% `scene: null` after two schedule
bugs were fixed (a closed-class leak, and `scene.ts` using only 3 of the
spec's 10 verb-function categories for every field); every level above L1 is
100% `scene: null`, because there is nothing left in the spec to classify
into. A slot with no scene falls back to an explicit instruction to invent
one ordinary, concrete moment - not history, war or mythology, all measured
failure modes of the bare fallback this replaced - but even that cannot save
a slot whose *assigned* words are themselves abstract or culturally loaded at
that frequency band (`déu`, `mort`, `antic` - "god", "death", "ancient" -
produced a text about a stone god holding life and death, prompt notwithstanding).
Extending the taxonomy past the beginner core, or adding a
concreteness/abstractness signal to `noun-features.ts` so `schedule.ts` can
route around the words no prompt can rescue, is real future work, not solved
here.

## 13. Some agreement features cannot be derived, so they are authored once

A learner-facing text needs a Catalan noun's gender before an article or
adjective can agree with it, and nothing in the lexicon recorded it.
`scripts/derive-ca-gender.ts` recovers it from each entry's own
`exampleTarget` - a determiner immediately before the headword (`la casa`) is
sound evidence and resolved 134 of 194 spec-typed nouns mechanically. A second,
weaker pass (`l'`-elision disambiguated by a same-sentence predicate adjective)
was tried and retired: a philologist review found it wrong 5 times in the 10
entries it fired on, because it could not tell a real predicate adjective from
an unrelated `-a`-ending noun or a 3rd-person `-ar` verb in the same sentence.
The remaining ~60 words - articleless mass nouns, the days of the week, two
genuinely epicene nouns (`estudiant`, `català`, marked `"common"` rather than
guessed into one gender) - are hand-resolved and were still reviewed before
shipping, the same one-batch-at-a-time discipline every other content change
in this repository goes through.

`src/lib/lang/<code>/surface.ts` is where that gender (and Dari's suppletive
presents and irregular plurals) becomes an actual inflected form: a
*generator*, built to emit exactly one correct surface, as distinct from
`lexicon-index.ts`, a *resolver* built to over-generate every plausible
surface a learner might tap. It no longer feeds a frame filler (§12) - its
consumer now is `scripts/author-texts.live.test.ts`'s drafting prompt, which
shows the model a word's correctly-inflected example form (`petit -> petita`,
a Dari verb's authored present stem) rather than trusting it to invent
morphology, PEDAGOGY's own named failure mode for exactly this. **A wrong
form is worse than a missing one, so it refuses rather than guesses**:
Catalan's `-t` adjective feminine is genuinely ambiguous from spelling alone -
`petit` → `petita` is the productive case, `cansat` → `cansada` (a participle
used as an adjective) devoices - and rather than pick the more common answer
silently, `surface.ts` requires the devoicing class in an authored
`IRREGULAR_FEMININE` table and defaults everything else to the productive
rule, throwing for anything neither covers. Both hazard lists came from a
philologist review, and each hazard is a test in `surface.test.ts`.

Three other features the authoring prompt uses - place, human, edible - cost
nothing new to add: they are pure functions over `beginner-spec.ts`'s existing
semantic-field resolution (`src/lib/content/noun-features.ts`), not a new
tagging pass. Countability and container-hood remain genuinely untagged;
`beginner-spec.json` says so itself for Objects & Tools. Concreteness/
abstractness is untagged too, and is what §12 names as the open gap behind
`scene: null` slots still producing occasionally wrong-in-kind content at
A1 and above - a real candidate for a fourth derived feature here, not solved
in this pass.
