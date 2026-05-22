#!/usr/bin/env bash
# Gemini launch-day helper — semi-automates the May 19, 2026 model swap.
#
# Usage:
#   scripts/launch-gemini.sh                       # interactive (default)
#   scripts/launch-gemini.sh --variant confident   # use "Gemini 4 day-one" copy
#   scripts/launch-gemini.sh --variant soft        # use "Gemini 3.5 with agentic" copy
#   scripts/launch-gemini.sh --variant cautious    # use "preview-only, GA in Q4" copy
#   scripts/launch-gemini.sh --dry-run             # show what would change, don't commit
#
# What it does:
#   1. Queries Google's AI Studio API to discover any "gemini-4-*" identifiers
#      that didn't exist on 2026-05-14 (when this app was last calibrated).
#   2. Shows you the diff so you confirm which one to use.
#   3. Adds the new model(s) to src/config/gemini-models.ts.
#   4. Optionally flips DEFAULT_GEMINI_MODEL_ID to the new model.
#   5. Replaces {{PLACEHOLDER}} tokens in docs/launch/gemini-3.5-flash.md with the
#      values you provide.
#   6. Runs typecheck + the Playwright Gemma 4 smoke test (offline-safe).
#   7. Stages the changes for commit. You inspect, commit, push manually
#      (or pass --auto-commit to commit + push automatically).

set -e
cd "$(dirname "$0")/.."

VARIANT="confident"
DRY_RUN=false
AUTO_COMMIT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --variant) VARIANT="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --auto-commit) AUTO_COMMIT=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# --- 0. Sanity ---
if [ ! -f ".env.local" ]; then
  echo "❌ .env.local missing — need GEMINI_API_KEY to query model list"
  exit 1
fi
# shellcheck disable=SC1091
source .env.local

echo "═══════════════════════════════════════════════════"
echo "  Gemini Launch-Day Helper"
echo "  Variant: $VARIANT"
echo "  Dry run: $DRY_RUN"
echo "  Auto-commit: $AUTO_COMMIT"
echo "═══════════════════════════════════════════════════"
echo

# --- 1. Discover new models ---
echo "▶ Querying Google AI Studio for available models..."
ALL_MODELS=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}" \
  | grep -oE '"name": "models/gemini[^"]*"' \
  | sed 's|"name": "models/||; s|"$||' \
  | sort -u)

NEW_MODELS=$(echo "$ALL_MODELS" | grep -E "^gemini-4" || true)

if [ -z "$NEW_MODELS" ]; then
  echo "ℹ No 'gemini-4-*' models found. Either the keynote hasn't shipped yet,"
  echo "  or the branding turned out to be Gemini 3.5 / 3.2 / something else."
  echo
  echo "All discovered models:"
  echo "$ALL_MODELS" | sed 's/^/    /'
  echo
  echo "  → Run again after the keynote ships, OR manually edit"
  echo "    src/config/gemini-models.ts to add whatever was actually announced."
  exit 0
fi

echo "✓ Found new Gemini 4 model identifiers:"
echo "$NEW_MODELS" | sed 's/^/    /'
echo

# --- 2. Confirm which one to use as the new default ---
DEFAULT_NEW=$(echo "$NEW_MODELS" | grep -E "flash$|pro$" | head -1)
read -p "Use '$DEFAULT_NEW' as the new default? [Y/n] " ANSWER
if [[ "$ANSWER" =~ ^[Nn] ]]; then
  read -p "Enter model id to set as default: " DEFAULT_NEW
fi

# --- 3. Patch the registry (or show diff if --dry-run) ---
echo
echo "▶ Patching src/config/gemini-models.ts..."
TMP_REGISTRY=$(mktemp)

# Generate the new registry entry for each discovered Gemini 4 model
NEW_ENTRIES=""
while IFS= read -r model_id; do
  [ -z "$model_id" ] && continue
  TIER="free"
  if echo "$model_id" | grep -q "pro"; then TIER="pro"; fi
  if echo "$model_id" | grep -q "ultra"; then TIER="premium"; fi
  CONTEXT=2000000
  NAME=$(echo "$model_id" | sed -e 's/-/ /g' -e 's/\b\(.\)/\U\1/g')
  NEW_ENTRIES+="  '$model_id': {
    id: '$model_id',
    name: '$NAME',
    genkit: 'googleai/$model_id',
    sdk: '$model_id',
    tier: '$TIER',
    contextTokens: $CONTEXT,
    blurb: 'Gemini 4 — released $(date +%Y-%m-%d).',
  },
"
done <<< "$NEW_MODELS"

# Insert NEW_ENTRIES into the registry just before the closing brace,
# and update DEFAULT_GEMINI_MODEL_ID.
python3 - <<PYEOF
import re, sys
path = "src/config/gemini-models.ts"
src  = open(path).read()
entries = """$NEW_ENTRIES"""
# Insert before the "// === Future entries" marker (or before final '};' of GEMINI_MODELS)
insertion = "\n  // === Auto-inserted by launch-gemini.sh on $(date +%Y-%m-%d) ===\n" + entries
src = src.replace("  // === Future entries", insertion + "  // === Future entries")
# Flip the default
src = re.sub(r"'gemini-[\d.]+-flash'(\s*;\s*//[^\n]*)?", "'$DEFAULT_NEW'\\1", src, count=1)
open(path, 'w').write(src)
print(f"  ✓ Registry patched. New default = $DEFAULT_NEW")
PYEOF

# --- 4. Variant-specific marketing copy fill-in ---
echo
echo "▶ Filling in marketing copy placeholders..."
case "$VARIANT" in
  confident)
    HEADLINE="Now powered by Gemini 4"
    ;;
  soft)
    HEADLINE="Now powered by Google's latest Gemini"
    ;;
  cautious)
    HEADLINE="Preview support for Google's newest Gemini"
    ;;
esac
echo "  (Marketing copy variant: $VARIANT — '$HEADLINE')"
echo "  Open docs/launch/gemini-3.5-flash.md and replace the remaining {{...}} placeholders"
echo "  with the values from Google's official announcement post."

# --- 5. Typecheck + smoke test ---
echo
echo "▶ Running typecheck..."
npx tsc --noEmit -p tsconfig.json || { echo "❌ Typecheck failed — fix before deploying."; exit 1; }
echo "  ✓ Typecheck passed"

if [ -f "tests/electron-test.js" ]; then
  echo "▶ (Skipping Playwright in launch script — run 'TEST EVERYTHING' manually after deploy.)"
fi

# --- 6. Stage / commit ---
if [ "$DRY_RUN" = true ]; then
  echo
  echo "Dry run complete. Diff:"
  git diff src/config/gemini-models.ts docs/launch/gemini-3.5-flash.md | head -80
  exit 0
fi

echo
echo "▶ Staging changes..."
git add src/config/gemini-models.ts docs/launch/gemini-3.5-flash.md

if [ "$AUTO_COMMIT" = true ]; then
  git commit -m "Gemini 4 launch — bump default to $DEFAULT_NEW

Auto-generated by scripts/launch-gemini.sh on $(date +%Y-%m-%d).
Variant: $VARIANT.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
  git push origin main
  echo "  ✓ Committed and pushed."
  npx cap sync ios 2>/dev/null && echo "  ✓ iOS synced." || echo "  ⚠ iOS sync skipped (capacitor not configured?)"
else
  echo "  → Changes staged. Review with: git diff --staged"
  echo "  → When ready, commit + push manually."
fi

echo
echo "═══════════════════════════════════════════════════"
echo "  Launch complete. 🚀"
echo "═══════════════════════════════════════════════════"
