# Darya Lexicon

`lexicon.json` is the app's Dari word database — standard Afghan Dari (Kabul),
English glosses, European-friendly transliteration (ā ē ī ō ū, kh/gh/ch/sh/zh, ʼ→',
w for و). Built from `scripts/data/core-lexicon-*.txt` by `pnpm build:lexicon`;
edit the data files, not the JSON.

## Curation principles

- **Dari, not Iranian Persian.** Dari-specific vocabulary is preferred and tagged
  `dari-specific`: پوهنتون (university), مکتب (school), موتر (car), سرک (street),
  بایسکل (bicycle), مقبول (beautiful), کلان (big), خورد (small), پیسه (money),
  بجه (o'clock), دریا (river), شفاخانه (hospital), کلکین (window), بلی (yes)…
- **Transliteration reflects Kabuli pronunciation**, including the majhul vowels
  ē/ō lost in Iranian Persian (شیر shēr "lion" vs shīr "milk", خوب khōb, روز rōz).
- **Surface-form matching, lemma entries.** Verbs are listed as infinitives with
  common conjugations in `variants`, so tapping می‌روم resolves to رفتن. Homographs
  (نه no/nine, شیر milk/lion) are one entry with a combined gloss.
- **Frequency ranks** are editorial, informed by open Persian corpora — the
  [behnam/persian-words-frequency](https://github.com/behnam/persian-words-frequency)
  Wikipedia/news lists and [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
  OpenSubtitles fa — re-weighted for spoken Afghan Dari (courtesy phrases, Afghan
  places and culture up; Iranian-specific items removed). Bands: 1 ≤ 100 <
  2 ≤ 250 < 3 ≤ 500 < 4 ≤ 800 < 5 ≤ 1200 < 6 ≤ 1700 < 7 ≤ 2400 < 8.
- **IDs (`lx-NNNN`) are stable**: data lines may be edited in place but never
  reordered or deleted once shipped — per-user SRS state references these IDs.

## Expansion

The core set (~280 entries, bands 1–5) is hand-curated. Expansion toward ~2,000
entries happens via `scripts/expand-lexicon.ts` (Gemini batch generation of
gloss/translit/example for new frequency-list words, always written back to the
data files for human review before commit).

License: CC BY-SA 4.0 (inherits from adapted corpora).
