#!/usr/bin/env bash
# Bring a new language's deployment up from an empty Supabase project.
#
#   ./scripts/bootstrap-lang.sh ca riera <supabase-project-ref>
#
# Prerequisite (must be done by a human): create the Supabase project. That
# command takes a --db-password, i.e. it mints a production database credential,
# which should be generated and held by you rather than by tooling:
#
#   npx supabase projects create riera \
#     --org-id ynxboefdfvdewjklaisi --region eu-west-3 --size micro
#
# Then put that project's URL and keys in .env.<lang>.local before running this.
set -euo pipefail

LANG_CODE="${1:?usage: bootstrap-lang.sh <lang> <app-name> <supabase-ref>}"
APP_NAME="${2:?usage: bootstrap-lang.sh <lang> <app-name> <supabase-ref>}"
PROJECT_REF="${3:?usage: bootstrap-lang.sh <lang> <app-name> <supabase-ref>}"
ENV_FILE=".env.${LANG_CODE}.local"

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE (Supabase URL + keys)"; exit 1; }

echo "==> 1/6  content and code are valid for '$LANG_CODE'"
pnpm validate:content --lang "$LANG_CODE"
pnpm typecheck
pnpm test

echo "==> 2/6  build the app for '$LANG_CODE'"
NEXT_PUBLIC_TARGET_LANG="$LANG_CODE" pnpm build

# The repo is linked to Darya's project; point it at the new one, then put it
# back afterwards so a later `supabase db push` cannot hit the wrong database.
PREV_REF="$(node -e "try{console.log(require('./supabase/.temp/linked-project.json').ref)}catch{console.log('')}")"
trap '[ -n "$PREV_REF" ] && npx supabase link --project-ref "$PREV_REF" >/dev/null 2>&1 || true' EXIT

echo "==> 3/6  link $PROJECT_REF and apply every migration"
npx supabase link --project-ref "$PROJECT_REF"
npx supabase db push

echo "==> 4/6  seed the $LANG_CODE lexicon and texts"
NEXT_PUBLIC_TARGET_LANG="$LANG_CODE" node --env-file="$ENV_FILE" scripts/seed.ts

echo "==> 5/6  create the Vercel project and its environment"
npx vercel project add "$APP_NAME" || echo "(project already exists)"
while IFS='=' read -r key value; do
  case "$key" in ''|\#*) continue ;; esac
  printf '%s' "$value" | npx vercel env add "$key" production --scope-project "$APP_NAME" >/dev/null 2>&1 || true
done < "$ENV_FILE"
printf '%s' "$LANG_CODE" | npx vercel env add NEXT_PUBLIC_TARGET_LANG production --scope-project "$APP_NAME" >/dev/null 2>&1 || true

echo "==> 6/6  deploy, then VERIFY the alias actually moved"
DEPLOY_URL="$(npx vercel deploy --prod --scope-project "$APP_NAME" 2>&1 | grep -oE 'https://[a-z0-9-]+\.vercel\.app' | tail -1)"
echo "deployed: $DEPLOY_URL"

# A 200 proves a page was served, not that it is *this* build. Fingerprint it.
# (Learned the hard way: a --prod deploy can leave the alias on an older build.)
sleep 10
if curl -fsSL --max-time 30 "$DEPLOY_URL/welcome" | grep -q "$APP_NAME"; then
  echo "OK: $DEPLOY_URL serves the $APP_NAME build"
else
  echo "WARNING: $DEPLOY_URL did not serve '$APP_NAME'. Check the alias:"
  echo "  npx vercel inspect $DEPLOY_URL"
  exit 1
fi

echo
echo "Done. $APP_NAME is live on its own Supabase project ($PROJECT_REF)."
echo "Darya is untouched: separate database, separate deployment, same repo."
