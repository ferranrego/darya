# Working on this repo

One codebase, two apps: **Riera** (Catalan, `ca`) and **Darya** (Dari, `prs`).
The language is chosen at build time from `NEXT_PUBLIC_TARGET_LANG`.

Read `docs/PEDAGOGY.md` before changing anything that decides what a learner is
taught: levels, word selection, the generation prompt, difficulty thresholds,
the SRS, or lexicon content. The numbers in it are the product.

## The five that have actually bitten

Each of these shipped, reached a learner, and was invisible until measured.

1. **A silent failure beats a loud one, every time.** Nothing here crashes. The
   grammar course taught `Vull que tu vinguis venir amb mi` for months; B2 texts
   contained none of the words they were written to teach; Catalan B2 learners
   were handed the C1 course and skipped B2 entirely. All of it rendered fine.
   If you change something learner-facing, **measure the output**, do not read
   the code and conclude it works.

2. **Both languages, every time.** `pnpm test` and `pnpm validate:content` run
   against *one* language. Run both:
   ```
   pnpm typecheck && pnpm lint
   for L in ca prs; do NEXT_PUBLIC_TARGET_LANG=$L pnpm test; \
     NEXT_PUBLIC_TARGET_LANG=$L pnpm validate:content --lang $L; done
   ```
   Scripts default to `prs`, so a bare `pnpm validate:content` in a Catalan
   session validates Dari and reports success.

3. **`content/active` is one shared symlink.** Only one language can run
   locally at a time. Flipping it under a running dev server leaves that server
   with its own branding and the other language's content, and nothing errors.
   Restart after switching. Tests no longer touch it - keep it that way.

4. **Never delete or renumber a lexicon entry.** `user_words.lexeme_id` is a
   foreign key and cached texts store `lexemeId` inside their JSON. Dropping an
   entry orphans real learner progress; renumbering ids silently repoints it at
   a different word. Repair in place. **Never run `audit-ca-lexicon.ts --fix`**,
   which does both.

5. **Comments here are load-bearing.** Most explain a specific incident. Do not
   delete one because the code looks self-evident - it looks self-evident
   *because* of the fix the comment describes. A comment that no longer matches
   its code is a defect: two of them were found asserting the opposite of what
   the code did.

## Content rules

- **A wrong entry is worse than a missing one.** Everything generated is guilty
  until proven innocent. Candidates that fail `verifyEntry` are dropped, not
  patched.
- **Author content rather than generating it** unless told otherwise. The 445
  broken Catalan entries all came from bulk generation passes.
- **Wrong-by-design content exists.** Distractors, `extraWords`, and the
  sentence in a `spotError` exercise are wrong on purpose. Do not "fix" them;
  the validators already skip them.
- **An agent finding graduates into a mechanical check.** That is the repo's
  pattern: a philologist found every seed-text token pointing at the wrong
  lexeme, and it is now a permanent check in `validate-content.ts`. A finding
  you only fix will come back.

## Cost

The app must never bill. Free-tier Groq → OpenRouter, and the daily token quota
is shared by every user of the deployment. Before adding or enlarging a model
call, **count calls per user action and estimate tokens**. Raising the known-word
prompt slice from 160 to 600 words exhausted a whole day's quota in one session.

Model output is untrusted input: Zod-parse it, and validate the assembled result
before it reaches a cache other learners read.

## Verification

`pnpm test` is offline. Live-provider checks are opt-in:

```
LIVE_AI=1 NEXT_PUBLIC_TARGET_LANG=ca AUDIT_PER_LEVEL=2 \
  pnpm exec vitest run --disable-console-intercept scripts/audit-generation.live.test.ts
```

That audit is the only thing that measures whether generated texts actually
teach. It prints coverage, new-words-used and part-of-speech mix per level, and
gates levels up to B2.

Catalan-specific gates: `node scripts/audit-ca-content.ts` (unteachable entries,
by level) and `node scripts/verify-ca-grammar.ts [--max-level B2]`.
