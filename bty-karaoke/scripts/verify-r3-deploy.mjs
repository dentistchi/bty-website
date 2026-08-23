// BUILD 26U-R3 — DEPLOY-1 … DEPLOY-6: the production deployment-state gate.
//
// STRICTLY READ-ONLY. Every call is a GET or a STABLE read-only RPC. It activates nothing,
// purchases nothing, grants nothing, and mutates no row. It exists so "is production still in
// the legacy-safe state?" is answerable by running one command instead of by remembering.
//
// Deliberately NOT a vitest file: the rest of the suite is offline and deterministic, and a test
// that reaches the internet would make CI depend on production being up. This follows the repo's
// existing `scripts/verify-*.mjs` convention instead.
//
// Run:  node scripts/verify-r3-deploy.mjs   (from bty-karaoke/)

import { readFileSync } from 'node:fs';

const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const vars = Object.fromEntries(
  raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_BASE = vars.KARAOKE_SUPABASE_URL;
const KEY = vars.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
const SITE = process.env.BTY_SITE ?? 'https://norebang.btydaily.com';
if (!URL_BASE || !KEY) {
  console.error('Missing KARAOKE_SUPABASE_URL / KARAOKE_SUPABASE_SERVICE_ROLE_KEY in .dev.vars');
  process.exit(2);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const get = async (p) => (await fetch(`${URL_BASE}/rest/v1/${p}`, { headers: H })).json();
const rpc = async (f, b = {}) =>
  (await fetch(`${URL_BASE}/rest/v1/rpc/${f}`, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(9)} ${detail}`);
};

console.log('\nBUILD 26U-R3 — production deployment-state gate (read-only)\n');

// ── DEPLOY-1 — the rollout switch is installed, and in the EXPECTED state ─────
//
// The expected value is a parameter, not a constant, because BUILD 26U-R4A runs a controlled
// validation under `dual_allowlist` before restoring `legacy_free`. Pass it explicitly so the
// gate keeps meaning something during that window instead of being commented out:
//     BTY_EXPECT_MODE=dual_allowlist node scripts/verify-r3-deploy.mjs
const EXPECT_MODE = process.env.BTY_EXPECT_MODE ?? 'legacy_free';
const policy = (await get('karaoke_usage_policy?select=*'))[0];
const mode = await rpc('karaoke_premium_room_mode');
check(
  'DEPLOY-1',
  policy?.premium_room_mode === EXPECT_MODE && mode === EXPECT_MODE,
  `premium_room_mode column=${JSON.stringify(policy?.premium_room_mode)} rpc=${JSON.stringify(mode)} (both must be ${JSON.stringify(EXPECT_MODE)})`,
);

// ── DEPLOY-1b — under dual_allowlist the boundary must hold to exactly one pair ──
if (EXPECT_MODE === 'dual_allowlist') {
  const rows = await get('karaoke_premium_room_rollout?select=account_id,room_id');
  check(
    'DEPLOY-1b',
    Array.isArray(rows) && rows.length === 1,
    `allowlist holds ${rows.length} pair(s) — a controlled validation must be exactly 1`,
  );
}

// ── DEPLOY-2 — commerce is still off ─────────────────────────────────────────
const catalog = await get('karaoke_product_catalog?select=product_code,is_active&order=display_order');
check(
  'DEPLOY-2',
  Array.isArray(catalog) && catalog.length === 3 && catalog.every((r) => r.is_active === false),
  `${catalog.length} rows, active=${catalog.filter((r) => r.is_active).length} — ${catalog.map((r) => `${r.product_code}:${r.is_active}`).join(' ')}`,
);

// ── DEPLOY-3 / DEPLOY-4 — client identity cannot change behaviour under legacy_free ──
//
// Resolved through the SAME pure matrix the server uses, against the LIVE mode read above. This
// is the honest form of the assertion: exercising the gated routes end-to-end needs an
// authenticated room credential, which is intentionally not recoverable from the database, so
// that half is a Founder device gate (F1-F7 / H1-H7).
const { resolveReleaseContract, parseClientRelease, normalizeRolloutMode } = await import(
  '../src/domain/release-contract.ts'
).catch(() => ({}));

if (typeof resolveReleaseContract === 'function') {
  const live = normalizeRolloutMode(mode);
  // Outside the controlled boundary (inRollout = false) — which is where every live production
  // room sits during R4A, and where everything sits in every other mode.
  const b109 = resolveReleaseContract(live, parseClientRelease(null), false);
  const b110 = resolveReleaseContract(live, parseClientRelease('native/110'), false);
  const web = resolveReleaseContract(live, parseClientRelease('web/abc'), false);
  check('DEPLOY-3', b109 === 'legacy', `build-109-shaped (no header) under live mode "${live}" → ${b109}`);
  check(
    'DEPLOY-4',
    b110 === 'legacy' && web === 'legacy',
    `build-110-shaped → ${b110}, web → ${web} (outside the rollout boundary, identity must not change behaviour)`,
  );
} else {
  check('DEPLOY-3', false, 'could not load the release-contract matrix (run with a TS-aware loader)');
  check('DEPLOY-4', false, 'could not load the release-contract matrix');
}

// ── DEPLOY-5 — rollout telemetry carries no user-identifying dimension ───────
const tel = await get('karaoke_release_clients_hourly?select=*&limit=1');
const cols = Array.isArray(tel) && tel.length ? Object.keys(tel[0]) : null;
const FORBIDDEN = ['account', 'room', 'event', 'session', 'token', 'ip', 'device', 'user_agent', 'fingerprint', 'slug'];
check(
  'DEPLOY-5',
  Array.isArray(tel) && (cols === null || (cols.length === 3 && !cols.some((c) => FORBIDDEN.some((f) => c.includes(f))))),
  cols === null
    ? 'table reachable and empty (no authenticated hosted-room traffic yet) — shape pinned by the migration CHECK'
    : `columns = ${cols.join(', ')}`,
);

// ── DEPLOY-6 — the free YouTube path is unaffected ──────────────────────────
try {
  const r = await fetch(`${SITE}/api/youtube/search?q=${encodeURIComponent('아이유 밤편지')}&style=karaoke`);
  const body = await r.json();
  const item = (body.items ?? [])[0];
  const openable = item && /^[A-Za-z0-9_-]{11}$/.test(item.videoId);
  const leaks = ['entitle', 'premium', 'rollout', 'storekit', 'pass_'].filter((k) =>
    JSON.stringify(body).toLowerCase().includes(k),
  );
  check(
    'DEPLOY-6',
    r.status === 200 && openable && leaks.length === 0,
    `HTTP ${r.status}, ${(body.items ?? []).length} items, first → https://www.youtube.com/watch?v=${item?.videoId ?? '?'}, entitlement leaks: ${leaks.length}`,
  );
} catch (e) {
  check('DEPLOY-6', false, `free search unreachable: ${e.message}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} passed\n`);
process.exit(failed.length ? 1 : 0);
