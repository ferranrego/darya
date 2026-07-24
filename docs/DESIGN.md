# Design System

**Feel:** light, spacious, elegant, quietly confident. The reading page is the product;
everything else stays out of its way. Restraint is the aesthetic.

## Palette - "Kabul paper & lapis"

| Token | Light | Role |
|---|---|---|
| `--paper` | `#FAF7F2` (warm paper-white) | app background |
| `--ink` | `#1F1A17` (warm near-black) | primary text |
| `--ink-soft` | `#6E6459` | secondary text |
| `--lapis` | `#2B4C8C` (Afghan lapis lazuli) | accent: actions, links, learning underline |
| `--lapis-deep` | `#1E3563` | pressed / emphasis |
| `--saffron` | `#D9A036` | streaks, celebration moments only |
| `--sabz` | `#3E7C59` (cypress green) | success, "known" confirmation |
| `--new-tint` | `#EFE9DD` | soft highlight behind unseen words |
| `--line` | `#E7E0D6` | hairlines, borders |

Rules: one accent (lapis) carries the interface. Saffron and sabz appear only at
meaningful moments (streak, word learned). No gradients as decoration. Dark mode is
out of scope for v1 (light is the identity); revisit in Phase 2.

## Typography

- **Dari:** Vazirmatn (variable, self-hosted). Reading body ≥ 28px / line-height ≥ 2.1,
  `word-spacing` slightly widened. Never letterspace Arabic script.
- **Latin (UI + translit):** Inter (variable, self-hosted). Translit rendered in
  `--ink-soft`, 0.8em of its Dari partner.
- Scale (px): 13 caption · 15 body · 17 emphasized · 22 title · 28 reading ·
  40 display / assessment words · 96 letter-forms.

## Space & layout

- 4px base grid; generous defaults (sections 32–48, screen padding 20–24).
- Mobile-first; reading column `max-width: 42rem` centered on desktop.
- Bottom tab bar (Home · Read · Review · Chat · You), translucent blur - the **only**
  glass surface in the app. Five destinations is the cap (iOS HIG / Material 3); anything
  else lives in the You hub. Words and Leaderboard are reached from there and from Home.
- Tap targets ≥ 44px; word tokens get invisible padding to reach it.

## Word-state language (core of the product)

- **new**: soft `--new-tint` rounded background.
- **learning**: 2px `--lapis` underline offset below the word.
- **known**: plain ink. Becoming plain *is* the reward.
- Transition new→learning: tint fades as underline draws in (300ms). learning→known:
  underline releases + one subtle sabz pulse (500ms), never confetti.

## Motion

Every animation has a job; if it has no objective, cut it.

| Moment | Job | Spec |
|---|---|---|
| Page/text transition | continuity | slide+fade 250ms ease-out |
| Word popover | connect word→meaning | spring from tapped word, stiffness 500, damping 35 |
| Review reveal | focus flip | card flip-fade 200ms |
| Review grade | confirm + advance | card exits toward its fate 250ms |
| Word learned | reward | sabz pulse 500ms |
| Assessment words | invite tapping | staggered rise-in 30ms/word |
| Streak/goal ring | progress feedback | ring sweep 600ms ease-in-out, once |
| Tab indicator | "where am I" | pill slides between tabs, spring stiffness 400, damping 32, mass 0.8 |

Respect `prefers-reduced-motion`: all of the above degrade to instant/opacity-only.

## RTL rules

- Dari containers get `dir="rtl" lang="prs"`; the app shell stays LTR.
- Logical CSS properties only (`margin-inline-start`, `padding-inline`, …).
- Mixed-direction surfaces (popover: Dari headword + English gloss) tested explicitly.

## Anti-slop checklist (audit every screen)

no decorative gradients · no glass beyond the tab bar · no emoji as UI · no dead
whitespace asymmetry · no default-blue focus rings (style them lapis) · no layout
shift on data load (skeletons sized exactly) · icons from one set (lucide) at one
stroke width · every empty state designed · no em dashes (`—`), ever; use regular dashes (`-`) or colons.

## Signature exception - the Home "Today" hero

One surface is deliberately allowed to break two rules above, **and only this one**:
the `TodayHero` card (`src/components/home/today-hero.tsx`). It is the home's focal
moment and earns a richer treatment.

- **Time-of-day tonal wash.** A very low-opacity radial glow (built from palette
  colours - saffron at dawn/dusk, lapis by day) shifts with the user's local hour.
  This is the one sanctioned gradient; it is ambient, never a "decorative" fill.
- **Night surface.** From ~22:00 the hero flips to a deep-lapis surface with light
  text and a sleeping Poncha. This is a *local* dark treatment, not app-wide dark
  mode (still out of scope). Everything outside the hero stays on paper.

Everywhere else the anti-slop checklist holds. Do not spread the wash or the dark
surface to other cards or screens.
