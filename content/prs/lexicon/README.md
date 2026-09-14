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

Exempt from the i rule: European loanwords that keep a real e sound (`model`,
`hotel`, `internet`, the `-lōzhī` sciences) and foreign proper names
(`tehrān`). They are listed in `SHORT_E_LOANWORDS` in
`src/lib/lang/prs/translit-check.ts`; add a word there only after checking
that it really is one. Afghan and Persian names take the rule (`hirāt`,
`afghānistān`).

`pnpm validate:content` enforces the i, chi and -ēm rules
(`shortEVowel`, `cheAsWord`, `verb1plIm`). When it fails after new content
lands, run `node scripts/normalise-dari-spelling.ts --dry`, read the report,
then `--apply`: it aligns each transliteration with its own Dari line, so it
can tell a kasra (→ i) from a majhul ē that lost its macron (`mekonad` for
می‌کند → mēkonad) and re-running it on its own output changes nothing.

## Expansion

The core set (~280 entries, bands 1–5) is hand-curated. Expansion toward ~2,000
entries happens via `scripts/expand-lexicon.ts` (Gemini batch generation of
gloss/translit/example for new frequency-list words, always written back to the
data files for human review before commit).

License: CC BY-SA 4.0 (inherits from adapted corpora).
