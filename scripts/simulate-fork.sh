#!/usr/bin/env bash
# Prove this tree can still be split into one repo per language.
#
#   ./scripts/simulate-fork.sh          # both directions
#   ./scripts/simulate-fork.sh ca       # just the Catalan-only build
#
# Deletes one language in place, runs the whole gate, and puts the tree back.
# Nothing is committed and content/ is restored from git, so a failed run costs
# a `git status` check, not a repair.
#
# Why this exists: grepping for `import ".../lang/<code>/..."` finds the module
# coupling and misses everything that names a language as *data* - the six test
# files that hardcoded `["ca", "prs"]` and then read `content/<lang>/`. In a
# single-language build four of them failed to load entirely, and the shared
# tree stayed green throughout, because both languages were present. Only
# actually removing one shows it.
#
# It deletes scripts/data/*<lang>* too. An earlier version did not, and so
# missed that `SeedTextSource` - the type every language's seed data is
# described by - lived inside the *Dari data file*, which the Catalan data file
# imported. The real fork caught it; the simulation had not. If this script says
# a split is viable, it has to actually be viable.
#
# Run this after touching anything under src/lib/lang, scripts/ or the tests
# that loop over languages.
set -euo pipefail
cd "$(dirname "$0")/.."

ONLY="${1:-}"
SNAP="$(mktemp -d)"
trap 'rm -rf "$SNAP"' EXIT

fail=0

simulate () {
  local KEEP="$1" DROP="$2"
  echo "======== keeping $KEEP, dropping $DROP ========"
  cp -R src "$SNAP/src" && cp -R scripts "$SNAP/scripts"
  rm -rf .next

  rm -rf "src/lib/lang/$DROP" "content/$DROP"
  if [ "$DROP" = "prs" ]; then
    rm -rf src/lib/ai/alphabet-reading.ts src/app/api/generate/alphabet-reading \
           "src/app/(app)/alphabet" src/components/alphabet
    rm -f scripts/enrich-verb-stems.ts scripts/fix-verb-pos.ts
    rm -f scripts/*prs*.* scripts/data/*prs*.*
  else
    rm -f scripts/*-ca-*.ts scripts/*ca*.cjs scripts/derive-ca-gender.ts \
          scripts/process-local-b2-lexicon.ts scripts/data/*ca*.*
    # add-lexicon-entries calls Catalan corpus attestation under a lang guard;
    # a Dari-only repo drops that block with the script it calls.
    python3 - <<'PY'
import re
p = "scripts/add-lexicon-entries.ts"; s = open(p).read()
s = re.sub(r'// The one place this shared tool.*?import \{ verifyEntry \} from "\./verify-ca-entries\.ts";\n', '', s, flags=re.S)
s = re.sub(r'\n  if \(lang === "ca"\) \{.*?\n  \}\n', '\n', s, flags=re.S)
open(p, "w").write(s)
PY
  fi

  python3 - "$KEEP" "$DROP" <<'PY'
import sys
keep, drop = sys.argv[1], sys.argv[2]
p = "src/lib/lang/index.ts"; s = open(p).read()
s = s.replace('import { %s } from "./%s/index.ts";\n' % (drop, drop), "")
s = s.replace("export const PROFILES = { prs, ca }", "export const PROFILES = { %s }" % keep)
s = s.replace('const DEFAULT_LANG: TargetLang = "prs";', 'const DEFAULT_LANG: TargetLang = "%s";' % keep)
open(p, "w").write(s)
PY
  rm -f content/active && ln -s "$KEEP" content/active

  local rc=0
  for step in "typecheck" "lint" "test" "validate:content --lang $KEEP"; do
    # shellcheck disable=SC2086
    if NEXT_PUBLIC_TARGET_LANG="$KEEP" pnpm $step >"$SNAP/out.txt" 2>&1; then
      echo "  ok   pnpm $step"
    else
      rc=1; fail=1
      echo "  FAIL pnpm $step"
      grep -E "error TS|FAIL|✗" "$SNAP/out.txt" | head -10 | sed 's/^/       /'
    fi
  done

  rm -rf src scripts && mv "$SNAP/src" src && mv "$SNAP/scripts" scripts
  git checkout -q -- content/ 2>/dev/null || true
  rm -f content/active && ln -s prs content/active
  rm -rf .next
  [ "$rc" = 0 ] && echo "  -> a $KEEP-only repo is viable"
}

[ -n "$(git status --porcelain content/)" ] && {
  echo "content/ has uncommitted changes; commit or stash first (this restores it from git)"; exit 1; }

case "$ONLY" in
  ca)  simulate ca prs ;;
  prs) simulate prs ca ;;
  "")  simulate ca prs; simulate prs ca ;;
  *)   echo "usage: $0 [ca|prs]"; exit 2 ;;
esac

exit "$fail"
