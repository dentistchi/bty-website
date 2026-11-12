# Arena release verification

Run the gate from the deployed commit in the root `bty-app` checkout. The
deployed origin and full Git SHA identify the result. The March 25, 2026
workflow artifact remains historical evidence for its original origin and
commit.

## Public checks

```sh
BASE_URL=https://arena.btydaily.com \
EXPECTED_SHA="$DEPLOYED_SHA" ARENA_GATE_MODE=public \
npm run verify:arena-release-gate
```

The script checks the build identity, the retired session route's explicit
410, the current session route's anonymous 401, and the same-origin 308
redirect from `/en/bty-arena/run` to `/en/bty-arena`. It leaves authentication
and learner state untouched. Run it against each serving origin.

## Authenticated checks

For the full gate, set `ARENA_GATE_MODE=authenticated` and supply
`E2E_EMAIL` and `E2E_PASSWORD` in the environment for a dedicated fixture
authorized on that origin. Prepare the fixture separately with the current
learner consent, approved Arena membership and a playable scenario. This
check signs in, so the fixture is subject to the normal authentication and
rate-limit rules. The Pipeline N session call can advance the fixture's
runtime state. Use a fixture reserved for this test.

The gate requires a login response with a session cookie, HTTP 200 from
`GET /api/arena/n/session?locale=en` with `ARENA_SCENARIO_READY` and a playable
scenario, and HTTP 200 from the canonical Arena page with that cookie. It
checks the exact SHA again at the end. The script neither seeds a database nor
loads a service role credential. It prints route results without cookie,
credential or response-body values.

Dispatch the **Arena release gate** workflow against `inner-main` after its
commit is deployed. It takes the origin and designated fixture credentials
from the repository's `BASE_URL`, `E2E_EMAIL` and `E2E_PASSWORD` secrets.
The authenticated `arena-release-gate-evidence` artifact from a green run
must match the deployed origin and SHA. Keep the actual Teams desktop/iPhone
results with the release. A public smoke pass covers the public checks only.
