/**
 * Typed, build-time loaders for the open content files. Content ships in the
 * app bundle, so no network round-trip for lexicon/course/levels.
 *
 * This file is now only a barrel over three modules, so server code, scripts
 * and tests can keep importing everything from one place:
 *
 *  - `levels.ts`  - level definitions; safe anywhere, including the app shell
 *  - `courses.ts` - alphabet, grammar, themes, placement; no lexicon
 *  - `lexicon.ts` - the 3.8 MB lexicon and its index
 *
 * **Client components must not import this file.** Doing so drags the lexicon
 * chunk (3.56 MB raw, 765 KB gzip) into that route - which is exactly how every
 * authenticated page came to download it. Import the narrow module instead;
 * `scripts/check-bundle.ts` fails the build when the lexicon chunk reaches a
 * route outside its allow-list.
 */
export * from "./levels";
export * from "./courses";
export * from "./lexicon";
