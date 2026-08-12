#!/usr/bin/env node
/**
 * BOUNDED WORKER CONVERGENCE CHECK (Slice 3.2P-A1).
 *
 * WHY THIS EXISTS AS A FILE. Every convergence check so far was an ad-hoc shell loop written in
 * the moment, and the last one was malformed — a broken `paste | bc` meant the exit condition
 * could never be true, so it hammered `/api/version` for ten minutes until the tool killed it.
 * Harmless, because the probes are read-only GETs, but it is exactly the kind of thing that
 * should not be retyped from memory each time.
 *
 * The rule it encodes: a deploy is converged only when EVERY probe agrees, and the wait is
 * always bounded. A partial agreement is edge propagation in progress — poll again — and it is
 * never reported as converged.
 *
 *   node scripts/verify-worker-convergence.mjs <expected-sha> [--probes 6] [--timeout 180]
 *
 * Exit 0 = all probes agree. Exit 1 = timed out, with the last observed spread printed.
 *
 * SISTER RULE, for the disposable live-DB harnesses this repo occasionally needs: give every
 * row a unique fingerprint column value, and delete by that fingerprint in a `finally`, so a
 * failed assertion cannot leave rows behind. A probe that threw before its cleanup is what left
 * three orphans on staging in 3.2P-R3.7-R2A; they were found and removed by fingerprint, which
 * only worked because there was one.
 */
const [, , expected, ...rest] = process.argv;
if (!expected) {
  console.error("usage: verify-worker-convergence.mjs <expected-sha> [--probes N] [--timeout SECONDS]");
  process.exit(2);
}
const arg = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && rest[i + 1] ? Number(rest[i + 1]) : fallback;
};
const PROBES = arg("probes", 6);
const TIMEOUT_MS = arg("timeout", 180) * 1000;
const INTERVAL_MS = 5000;
const URL = "https://bty-arena-staging.ywamer2022.workers.dev/api/version";

const probeOnce = async () => {
  const seen = [];
  for (let i = 0; i < PROBES; i += 1) {
    // Cache-busted so each probe can land on a different PoP.
    const res = await fetch(`${URL}?cb=${Date.now()}-${i}-${Math.floor(Math.random() * 1e9)}`);
    const body = await res.json().catch(() => ({}));
    seen.push(String(body.version ?? "unreadable"));
  }
  return seen;
};

const started = Date.now();
let attempt = 0;
for (;;) {
  attempt += 1;
  const seen = await probeOnce();
  const agree = seen.filter((v) => v === expected).length;
  if (agree === PROBES) {
    console.log(`converged ${agree}/${PROBES} on ${expected} (attempt ${attempt})`);
    process.exit(0);
  }
  const spread = [...new Set(seen)].map((v) => `${v.slice(0, 12)}×${seen.filter((s) => s === v).length}`).join("  ");
  const elapsed = Date.now() - started;
  if (elapsed >= TIMEOUT_MS) {
    console.error(`NOT CONVERGED after ${attempt} attempts / ${Math.round(elapsed / 1000)}s — ${agree}/${PROBES}`);
    console.error(`  last spread: ${spread}`);
    process.exit(1);
  }
  console.log(`attempt ${attempt}: ${agree}/${PROBES} — ${spread}`);
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
}
