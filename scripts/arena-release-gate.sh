#!/usr/bin/env bash
# Verify the deployed SHA and Pipeline N. The authenticated check uses a
# dedicated, pre-provisioned fixture; the public check uses no credentials.
set -euo pipefail
umask 077

fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }

BASE="${BASE_URL:-}"
BASE="${BASE%/}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
MODE="${ARENA_GATE_MODE:-authenticated}"
[[ "$EXPECTED_SHA" =~ ^[a-f0-9]{40}$ ]] || fail "EXPECTED_SHA must be a full Git SHA"
[[ "$MODE" == public || "$MODE" == authenticated ]] || fail "ARENA_GATE_MODE must be public or authenticated"
node -e '
  try {
    const raw = process.argv[1];
    const url = new URL(raw);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (raw !== url.origin || (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))) process.exit(1);
  } catch { process.exit(1); }
' "$BASE" || fail "BASE_URL must be an HTTPS origin or a loopback HTTP origin"

evidence_dir="$(mktemp -d)"
trap 'rm -rf "$evidence_dir"' EXIT
cookie_jar="$evidence_dir/cookies"
: > "$cookie_jar"
export BASE

request() {
  local expected="$1" path="$2" status
  shift 2
  status="$(curl -sS --connect-timeout 10 --max-time 30 --proto '=https,http' \
    -H 'Cache-Control: no-cache' -D "$evidence_dir/headers" -o "$evidence_dir/body" \
    -w '%{http_code}' "$@" "$BASE$path")" || fail "$path request failed"
  [[ "$status" == "$expected" ]] || fail "$path returned HTTP $status (expected $expected)"
  printf 'PASS %s HTTP %s\n' "$path" "$status"
}

check_json() {
  local check="$1"
  node -e '
    try {
      const body = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
      const [check, expected] = process.argv.slice(2);
      const passed = check === "version" ? body.version === expected
        : check === "deprecated" ? body.error === "arena_session_next_deprecated"
        : body.ok === true && body.mode === "arena" && body.runtime_state === "ARENA_SCENARIO_READY" &&
          body.gates?.next_allowed === true && typeof body.scenario?.scenarioId === "string" &&
          body.scenario.scenarioId.length > 0;
      if (!passed) process.exit(1);
    } catch { process.exit(1); }
  ' "$evidence_dir/body" "$check" "$EXPECTED_SHA" || fail "$check response did not match the contract"
}

printf 'BASE_URL=%s\nEXPECTED_SHA=%s\nMODE=%s\n' "$BASE" "$EXPECTED_SHA" "$MODE"
request 200 /api/version
check_json version
request 410 '/api/arena/session/next?locale=en'
check_json deprecated
request 401 '/api/arena/n/session?locale=en'
request 308 /en/bty-arena/run --head
location="$(awk 'tolower($1)=="location:" { sub(/^[^:]*:[ \t]*/, ""); sub(/\r$/, ""); print; exit }' "$evidence_dir/headers")"
case "$location" in
  /en/bty-arena|"$BASE/en/bty-arena") ;;
  *) fail "legacy run did not redirect to the same-origin canonical Arena" ;;
esac

if [[ "$MODE" == public ]]; then
  printf 'ARENA PUBLIC SMOKE PASSED\n'
  exit 0
fi

[[ -n "${E2E_EMAIL:-}" && -n "${E2E_PASSWORD:-}" ]] || fail "authenticated mode requires a dedicated E2E fixture"
node -e 'process.stdout.write(JSON.stringify({email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD}))' |
  request 200 /api/auth/login --request POST --header 'Content-Type: application/json' \
    --data-binary @- --cookie-jar "$cookie_jar"
rg -qi '^set-cookie:' "$evidence_dir/headers" || fail "login did not issue a session cookie"

request 200 '/api/arena/n/session?locale=en' --cookie "$cookie_jar"
check_json scenario
request 200 /en/bty-arena --cookie "$cookie_jar"
request 200 /api/version
check_json version
printf 'ARENA AUTHENTICATED RELEASE GATE PASSED\n'
