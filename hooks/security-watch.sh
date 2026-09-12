#!/usr/bin/env bash
# PostToolUse hook - record when a write touches a security-trigger surface.
#
# registry/intents.json declares security review MANDATORY whenever the change surface
# touches auth, credentials, outbound network, and six other surfaces. That declaration
# is prose: nothing read it, and in the first real end-to-end run the change touched
# THREE of those surfaces and security review never ran. Nobody noticed, because
# nothing was watching.
#
# This watches. It cannot force a review, but it makes skipping one visible at the
# Stop boundary instead of invisible forever.
#
# Never fails the tool call.

set -uo pipefail

payload="$(cat 2>/dev/null || true)"

path="$(printf '%s' "$payload" \
  | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' \
  | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"

[ -z "$path" ] && exit 0

# Source files only - a README mentioning "password" is not a security surface.
case "$path" in
  *.py|*.ts|*.tsx|*.js|*.jsx|*.mjs|*.go|*.rs|*.java|*.kt|*.kts|*.swift|*.dart\
  |*.cs|*.fs|*.cpp|*.cc|*.hpp|*.h|*.c|*.php|*.rb|*.vue|*.svelte|*.sql|*.tf|*.yml|*.yaml) ;;
  *) exit 0 ;;
esac

# Map matched content to the surface it represents, so the Stop report can name the
# specific trigger rather than saying "something security-ish happened".
declare -A SURFACES=(
  ["authentication or authorization"]='login|logout|authenticate|authoriz|session|jwt|oauth|permission|role_?check|is_?admin'
  ["secrets, tokens, credentials, or environment config"]='password|passwd|secret|api_?key|token|credential|private_?key|getenv|environ'
  ["outbound network or external API calls"]='requests\.|httpx\.|fetch\(|axios|urlopen|http\.client|HttpClient|WebClient'
  ["database queries or ORM filters"]='SELECT |INSERT |UPDATE |DELETE |execute\(|raw\(|\.query\('
  ["user-input handling or deserialization"]='pickle\.|yaml\.load|eval\(|exec\(|deserial|JSON\.parse|request\.(body|json|form|args)'
  ["file-system paths or uploads"]='open\(|readFile|writeFile|os\.path|Path\(|upload'
  ["cryptography, hashing, or randomness"]='hashlib|bcrypt|hmac|encrypt|decrypt|random\.|crypto\.'
  ["session, cookie, or CORS handling"]='cookie|set_?cookie|CORS|Access-Control|SameSite'
)

mkdir -p .onestop 2>/dev/null || exit 0

for surface in "${!SURFACES[@]}"; do
  if printf '%s' "$payload" | grep -qiE "${SURFACES[$surface]}"; then
    printf '%s\t%s\n' "$path" "$surface" >> .onestop/security-flags 2>/dev/null || true
  fi
done

exit 0
