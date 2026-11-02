# Healing completion SQL verification — 2026-10-31

The independent harness is `scripts/healing-atomic-postgres-qa.ts`. It imports no
application environment, Supabase client, provider, auth session or production URL.
It accepts an explicit migration file and either one in-memory PGlite session or
one exact disposable native PostgreSQL target. The only native client target is
literal loopback, port 55473, database `bty_healing_atomic_qa`; an existing app table
causes refusal before fixture setup. A Docker private server address requires both
the explicit container flag and `GITHUB_ACTIONS=true`; public/masked addresses fail.

The fixture uses only source-relevant columns, the exact original Healing acts and
milestone migrations, and the original advanced-unlock DDL/RLS block. It is **not**
the full production Supabase migration stack. Synthetic users/train days/progress
exist only in this explicitly disposable database.

## Oracle and observed SQL evidence

The legacy act contract remains 1→2→3, exactly 28 distinct completed train days and
409 on a healthy duplicate. Final-act insert plus phase marker must commit together.
Ritual completion must atomically persist its marker and optional PRM/SAG unlock.
Healthy ritual replay returns the stored time/starter without regranting; missing
historical evidence is review-required, not an inferred backfill.

One oracle clarification is recorded explicitly. The initial preexisting-unlock
case expected a new successful completion preserving its old timestamp. The parent
specified that an existing requested unlock without a completion marker is ambiguous
and must return review-required with no writes. The first run passed 23 checks then
stopped at that policy disagreement. The corrected oracle preserves that old row
and expects refusal. A subsequent independent run caught a real act-mode guard gap:
a stored starter designation without its unlock returned duplicate409 instead of
review-required. The SQL author fixed that guard before the green measurement.

Migration SHA256:
`d1d9f2cc68ad36cbad0bcd1494091bfb5fe91c1d136e5c97c4429ccdd0a89d6f`.

Observed **52/52 SQL checks passed** on PostgreSQL17.5 via PGlite0.3.14. Includes
prefix/order/eligibility boundaries, raw replay snapshots, historical review,
10 error/suppressed-write rollback-and-retry stages, retained owner SELECT RLS,
revoked direct completion writes, service-only execute and empty-search-path invoker.
The two always-active harness guard tests and focused strict TypeScript also pass.

## Native concurrency gate

PGlite is one session and supplies **no** native contention evidence. Six explicit
native cases are prepared: eight duplicate final-act requests, eight ritual
requests, overlapping ordered acts, both cross-mode arrival orders and an unrelated
user completing while the first user's transaction is held. Contenders use separate
backend IDs and must be observed waiting on real locks before the gate opens.
The mixed-order tests preserve the existing separate-mode policies: act-first never
invents a Starter grant; ritual-first refuses further new acts. Native checks were
unrun during initial source preparation. Integration subsequently observed
**58/58 checks on PostgreSQL17.11**, including these six race groups, in
[run 41258285658](https://github.com/dentistchi/bty-website/actions/runs/41258285658)
at source `5d287b4f`. The [JSON receipt](release-reliability/native-healing.json)
and compressed raw job log record distinct backend IDs, SQL lock waits and
`unrun: []`. This is disposable CI evidence, not production application.

```sh
HEALING_ATOMIC_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55473/bty_healing_atomic_qa \
node --import tsx scripts/healing-atomic-postgres-qa.ts --postgres \
  --migration /absolute/path/to/20261101000728_healing_awakening_atomic_completion.sql
```

CI Docker additionally sets `HEALING_ATOMIC_TEST_CONTAINER_SERVICE=1`. Optional
embedded execution uses `--pglite` and an absolute `HEALING_ATOMIC_PGLITE_MODULE`
path. The CLI prints every executed check plus engine/version/migration hash and
an explicit `unrun` list. Guard-test success alone never implies SQL or native PASS.
No production migration or permission change is performed by this work.
