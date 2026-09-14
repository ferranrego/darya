# Darya Lexicon

`lexicon.json` is the app's Dari word database: standard Afghan Dari (Kabul),
English glosses, European-friendly transliteration (ā ē ī ō ū, kh/gh/ch/sh/zh, ʼ→',
w for و). Built from `scripts/data/core-lexicon-*.txt` by `pnpm build:lexicon`;
edit the data files, not the JSON.

## Curation principles

- **Dari, not Iranian Persian.** Dari-specific vocabulary is preferred and tagged
  `dari-specific`: پوهنتون (university), مکتب (school), موتر (car), سرک (street),
  بایسکل (bicycle), مقبول (beautiful), کلان (big), خورد (small), پیسه (money),
  بجه (o'clock), دریا (river), شفاخانه (hospital), کلکین (window), بلی (yes)…
- **Transliteration reflects Kabuli pronunciation**, including the majhul vowels
  ē/ō lost in Iranian Persian (شیر shēr "lion" vs shīr "milk", دوست dōst, روز rōz).
- **Surface-form matching, lemma entries.** Verbs are listed as infinitives with
  common conjugations in `variants`, so tapping می‌روم resolves to رفتن. Homographs
  (نه no/nine, شیر milk/lion) are one entry with a combined gloss.
- **Frequency ranks** are editorial, informed by open Persian corpora: the
  [behnam/persian-words-frequency](https://github.com/behnam/persian-words-frequency)
  Wikipedia/news lists and [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
  OpenSubtitles fa, re-weighted for spoken Afghan Dari (courtesy phrases, Afghan
  places and culture up; Iranian-specific items removed). Bands: 1 ≤ 100 <
  2 ≤ 250 < 3 ≤ 500 < 4 ≤ 800 < 5 ≤ 1200 < 6 ≤ 1700 < 7 ≤ 2400 < 8.
- **IDs (`lx-NNNN`) are stable**: data lines may be edited in place but never
  reordered or deleted once shipped, since per-user SRS state references these IDs.

## Transliteration convention

One spelling app-wide - lexicon, grammar course, Grammar Hub, seed texts,
alphabet course, level descriptions and `src/lib/lang/prs/`. The app has no
audio, so the Latin line is the only pronunciation a learner gets.

| Rule | Write | Not |
|---|---|---|
| Short kasra is **i** (Dari has three short vowels: a, i, u) | kitāb, bisyār, zindagī, mu'allim, imrōz, shāgird | ketāb, besyār |
| **Majhul ē/ō** keep their macron and never become i/u | dōst, nēst, sē, mē-, pēsh | dost, se, me-, pesh |
| The **ezafe** stays -e / -ye (its own hyphen segment) | kitāb-e man, khāna-ye mā | kitāb-i man, khāna-e mā |
| چه is **chi**, in compounds too; spoken چی is chī | chi, chirā, chitōr | che, cherā, chetōr |
| که is **ki** (and balki, chunki, agarchi) | ki | ke |
| 1pl verb ending is majhul **-ēm** | mērawēm, hastēm, kardēm | mērawīm, hastīm |
| Subjunctive/imperative prefix is **bu-** (biyā before ā) | bubīn, bugīr, budih | bebīn, bi-gīr |
| 2sg verb ending is **-ī** | hastī, mērawī | hasti |
| خوب is **khūb**; خوا- is **khā** | khūb, mēkhāham | khōb, mēkhwāham |
| A final ه is **-a** | khāna, qissa | khāne |
| Arabic words keep their **a** (the Iranian e is not a kasra) | ta'dād, takrār, takya, asālat, zamānat, wakālat | ti'dād, tikrār |
| The agent suffix ـنده is **-anda** | nawīsanda, paranda, kunandagān, dihanda | nawīsinda, parinda (but zinda) |
| A ی written inside a word is **ē or ī**, never short i | rēzish, pēchish, andēsha, hawēlī, bē-rawiya | rizish, bi-rawiya |
| Letter names have majhul ē; alif with i | alif, bē, pē, tē, sē, chē, khē, rē, zē, zhē, fē | alef, be |

Exempt from the i rule: European loanwords that keep a real e sound (`model`,
`hotel`, `internet`, the `-lōzhī` sciences), and names of places and people
outside Afghanistan, which keep their own spelling (`tehrān`, `dānte`). They
are listed in `SHORT_E_LOANWORDS` in `src/lib/lang/prs/translit-check.ts`;
add a word there only after checking that it really is one. Afghan names take
the rule (`hirāt`, `afghānistān`, `mazār`).

Each loanword has **one** spelling, the one the lexicon teaches at the lowest
band: `tēlifōn`, `sīstim`, `sigrit`, `mitr`, `restorān`, `model`, `modern`,
`hāstel`, `kānkrīt`, `plān`. Only the winning spelling may be listed as an
exception, so a losing variant fails validation if it comes back. The
prothetic vowel before s + consonant is written **i**, as in `istres`:
`istāndārd`, `iskan`, `isklerōz`, `ispūtnīk`.

`pnpm validate:content` enforces the i, chi, -ēm and bu- rules
(`shortEVowel`, `cheAsWord`, `verb1plIm`, `nonBuPrefix`) on every
transliteration field and, through `shortEInLooseText`, on hub table rows,
pattern parts and course table cells. It also warns - review, not an error -
about words whose Dari writes a ی inside the word while the Latin shows no
long vowel (`medialYehWithoutLongVowel`): whether that vowel is ē or ī needs a
person (`tārīk`, not `tarēk`).

When it fails after new content lands, run
`node scripts/normalise-dari-spelling.ts --dry`, read the report, then
`--apply`: it aligns each transliteration with its own Dari line, so it can
tell a kasra (→ i) from a majhul ē that lost its macron (`mekonad` for می‌کند
→ mēkonad), and re-running it on its own output changes nothing.

### Known open issues (a later pass)

Found by the philologist while reviewing the i sweep, deliberately not fixed
in it, because each is its own sweep of about the same size:

- **Arabic taf'īl nouns written with ē for ī**: `ta'kēd` ×11 beside `ta'kīd`
  ×4, `ta'yēd`, `ta'sēr`, `ta'mēn`, `tasmēm`, `tafsēr`, `tashkēl`, `tawjēh`.
  The reverse of the ی rule above.
- **Iranian o for u** is still widespread: `mēkonad`, `mokhtal`, `mohim`,
  `konish`, `sho'arā`.
- **The -ī adjective suffix written -ē** (`ismē-ye`, `ilmē-ye`): -ē is the
  indefinite ending, not the adjective.
- Also listed by the validator's ی warning: flattened ī in high-register
  entries (`kharid`, `tahlil`, `natija`, `daqiqa`, `in` for īn).
- Waiting for a native speaker: `sākhtimān` or `sākhtmān`; `serī` (سری,
  series) against `siri`; `injinīr`; `kōlerā` or `kōlarā`; the letter
  names of ح and ه.

## Expansion

The core set (~280 entries, bands 1–5) is hand-curated. Expansion toward ~2,000
entries happens via `scripts/expand-lexicon.ts` (Gemini batch generation of
gloss/translit/example for new frequency-list words, always written back to the
data files for human review before commit).

License: CC BY-SA 4.0 (inherits from adapted corpora).
