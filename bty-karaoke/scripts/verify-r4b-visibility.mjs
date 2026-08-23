// BUILD 26U-R4B §6 — the COMMERCE VISIBILITY DIFFERENTIAL, against production.
//
// STRICTLY READ-ONLY. No purchase, no grant, no activation, no write of any kind.
//
// The claim under test: activating PASS_1H made it visible to the controlled build-110 client
// inside the boundary, AND to nobody else — most importantly not to the immutable public build
// 109, which already ships dormant commerce UI and cannot be fixed if it is wrong.
//
// WHAT THIS CAN AND CANNOT REACH. The catalog route requires an authenticated host credential,
// and host tokens are deliberately not recoverable from the database (established in 26T-R1A).
// So the authenticated 200-with-a-product half is a Founder device gate (§7), not something a
// script can fake. What IS provable here, against live production rather than a fixture:
//   the live mode, the live allowlist, the live catalog, the live owner resolution, and the pure
//   matrix those feed — plus the negative half end-to-end (no identity gets commerce unauthed).
// The composition of those into the route response is pinned by COMMERCE-COMPAT-1..4.
//
// Run:  npx tsx scripts/verify-r4b-visibility.mjs

import { readFileSync } from 'node:fs';
import { resolveReleaseContract, parseClientRelease, normalizeRolloutMode } from '../src/domain/release-contract.ts';

const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const vars = Object.fromEntries(
  raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL_BASE = vars.KARAOKE_SUPABASE_URL;
const KEY = vars.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
const SITE = process.env.BTY_SITE ?? 'https://norebang.btydaily.com';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const get = async (p) => (await fetch(`${URL_BASE}/rest/v1/${p}`, { headers: H })).json();
const rpc = async (f, b = {}) =>
  (await fetch(`${URL_BASE}/rest/v1/rpc/${f}`, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();

const results = [];
const check = (id, ok, detail) => { results.push({ id, ok }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(6)} ${detail}`); };

console.log('\nBUILD 26U-R4B §6 — commerce visibility differential (production, read-only)\n');

const ACCT = '1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c';
const ROOM = 'b28fc301-75e8-4f23-910f-37f6013f5b80';
const mode = normalizeRolloutMode(await rpc('karaoke_premium_room_mode'));

// ── V-1 — exactly one product is active, and it is the 1-hour pass ──
const cat = await get('karaoke_product_catalog?select=product_code,storekit_product_id,duration_seconds,is_active&order=display_order');
const on = cat.filter((r) => r.is_active);
check('V-1', on.length === 1 && on[0].product_code === 'PASS_1H' && on[0].duration_seconds === 3600,
  `active=[${on.map((r) => `${r.product_code}/${r.duration_seconds}s`).join(',')}] — 4h and 24h must stay off`);

// ── V-2 — the allowlist admits the Founder account and refuses a stranger ──
const other = (await get(`karaoke_accounts?select=id&id=neq.${ACCT}&limit=1`))[0]?.id;
const inA = await rpc('karaoke_account_in_premium_rollout', { p_account_id: ACCT });
const outA = await rpc('karaoke_account_in_premium_rollout', { p_account_id: other });
const nullA = await rpc('karaoke_account_in_premium_rollout', { p_account_id: null });
check('V-2', inA === true && outA === false && nullA === false,
  `account in rollout: founder=${inA}, another real account=${outA}, null=${nullA}`);

// ── V-3 — SPENDING is pair-scoped: the same owner's other live room is NOT in ──
const home = (await get('karaoke_rooms?select=id,slug&slug=eq.bty-home'))[0];
const inR = await rpc('karaoke_room_in_premium_rollout', { p_room_id: ROOM });
const outR = await rpc('karaoke_room_in_premium_rollout', { p_room_id: home?.id });
check('V-3', inR === true && outR === false,
  `room in rollout: R4B room=${inR}, bty-home (SAME owner, live)=${outR} — account visibility must not become room authority`);

// ── V-4 — the differential itself, resolved through the live mode ──
const m = (c, r) => resolveReleaseContract(mode, parseClientRelease(c), r);
const b109in = m(null, true), b110in = m('native/110', true), webIn = m('web/x', true);
const b109out = m(null, false), b110out = m('native/110', false);
check('V-4', b109in === 'legacy' && b110in === 'premium' && webIn === 'premium' && b109out === 'legacy' && b110out === 'legacy',
  `mode="${mode}": inside → b109=${b109in} b110=${b110in} web=${webIn} | outside → b109=${b109out} b110=${b110out}`);

// ── V-5 — build 109 is the one that cannot be fixed, so state its outcome alone ──
check('V-5', b109in === 'legacy' && b109out === 'legacy',
  `the immutable public build resolves legacy in BOTH positions — its dormant commerce UI can never be fed a product`);

// ── V-6 — no identity string obtains commerce without a host credential ──
const probes = [['(none)', {}], ['native/109', { 'x-bty-client': 'native/109' }], ['native/110', { 'x-bty-client': 'native/110' }],
  ['native/999', { 'x-bty-client': 'native/999' }], ['garbage', { 'x-bty-client': 'native/../../admin' }]];
let leaked = [];
for (const [label, hdr] of probes) {
  const r = await fetch(`${SITE}/api/host/commerce/catalog`, { headers: hdr });
  const body = await r.text();
  if (r.status === 200 || body.includes('storekit') || body.includes('1hour')) leaked.push(`${label}:${r.status}`);
}
check('V-6', leaked.length === 0,
  `${probes.length} unauthenticated identity probes against live production, 0 must return a product — leaks: ${leaked.length ? leaked.join(' ') : 'none'}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} passed\n`);
process.exit(failed.length ? 1 : 0);
