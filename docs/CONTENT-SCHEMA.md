# Open Content Schema

All learnable content is open, versioned JSON under `content/`, decoupled from the app
so it can be reused, remixed, and consulted by other tools. The normative definitions
live in [`src/lib/content/schema.ts`](../src/lib/content/schema.ts) (Zod); machine-readable
JSON Schemas are exported to `content/schema/*.schema.json` by `pnpm export:schemas`.

Current `formatVersion`: **1.2.0** - additive changes bump minor, breaking changes bump
major and get a migration note here.

Version history:

- **1.2.0** - lexicon entries gain optional `presentStem` (present stem in Persian
  script for verbs, e.g. کردن → کن). Together with the past stem derived from the
  infinitive, it lets consumers generate the full regular conjugation paradigm; the
  app does this at runtime in `buildLexiconIndex` rather than materializing forms
  into `variants`.
- **1.1.0** - alphabet course gains `recognizeForm` and `constructWord` exercise types.
- **1.0.0** - initial format.

| File | Schema | Contents |
|---|---|---|
| `content/lexicon/lexicon.json` | `lexicon.schema.json` | Dari lexemes: script, normalized form, transliteration, English gloss, POS, frequency rank + band (1–8), register, variants, present stem (verbs), example sentence, tags |
| `content/alphabet/course.json` | `alphabet-course.schema.json` | Ordered units teaching the 32-letter Dari alphabet: letters with all four positional forms, plus exercises (tagged union: `recognizeLetter`, `pickForm`, `matchSound`, `readWord`, `readSentence`) |
| `content/levels/levels.json` | `levels.schema.json` | Level definitions (L1–L6): frequency bands allowed, entry known-word counts, text length ranges, permitted grammar (drives both assessment and the generation prompt) |
| `content/texts/seed/*.json` | `text-document.schema.json` | Texts in `TextDocument` format - identical for hand-authored seed texts and AI-generated ones (which are cached in DB and exportable back to this format) |

## Conventions

- **IDs are stable and never reused**: `lx-0042` (lexeme), `au-03` (alphabet unit),
  `L2` (level), `tx-seed-l1-001` / `tx-gen-<hash>` (text). All cross-references and all
  per-user data use these IDs.
- **Normalization** (`src/lib/text/normalize.ts`): NFC, Arabic ي/ك folded to Persian
  ی/ک, ZWNJ (U+200C) preserved, Arabic-Indic digits kept. `targetNormalized` is the
  matching key for tokenization.
- **`target` is the text in the language being learned.** The field is deliberately
  not called `dari`: the schema is language-neutral, and only the normalization rules
  above are Dari-specific.
- **Tokens** link every word of every sentence to a lexeme ID (or `null` for proper
  names/unmatched), so any consumer can compute coverage, difficulty, or highlighting
  without re-tokenizing.
- **Validation**: `pnpm validate:content` checks every file against its schema *and*
  cross-file integrity (token lexeme IDs exist, exercise targets exist in taught
  letters, level references resolve).
- **License**: content files are CC BY-SA 4.0 (they adapt open Persian frequency
  corpora); see `content/lexicon/README.md` for sources.
