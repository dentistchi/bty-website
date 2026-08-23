// BUILD 26U-R4B — the purchase census. STRICTLY READ-ONLY.
//
// One command that answers "what does production hold right now?" for every quantity §8, §10,
// §11, §12, §13 and §16 ask about. Run it BEFORE the Sandbox purchase to capture the baseline,
// and again after each device step; the deltas are the evidence.
//
// It writes nothing, purchases nothing, activates nothing, and never prints a secret: the Apple
// transaction id is reported as a truncated SHA-256 fingerprint, never in the clear.
//
// Run:  npx tsx scripts/r4b-census.mjs [label]

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const vars = Object.fromEntries(
  raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const U = vars.KARAOKE_SUPABASE_URL, K = vars.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
const count = async (t) => {
  const r = await fetch(`${U}/rest/v1/${t}?select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range');
  return cr ? Number(cr.split('/')[1]) : `UNREADABLE(${r.status})`;   // never silently 0
};
// Apple transaction ids are SECRETS: hashed, never printed, at any length.
const fp = (s) => (s ? createHash('sha256').update(String(s)).digest('hex').slice(0, 12) : '—');
// Grant ids are NOT secrets — they are opaque internal row ids that address nothing on their own,
// and the Founder must be able to match a row here against the label on a card. So they are
// truncated, not hashed, and truncated at the SAME END and LENGTH as the device's
// `GateFVLog.grantFingerprint` (first 8). Hashing here and truncating there would have produced
// two fingerprints for one grant that can never be matched — which is what this script did first.
const gfp = (s) => (s ? String(s).slice(0, 8) : '—');

const ACCT = '1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c';
const ROOM = 'b28fc301-75e8-4f23-910f-37f6013f5b80';

console.log(`\nBUILD 26U-R4B census — ${process.argv[2] ?? 'unlabelled'} — ${new Date().toISOString()}\n`);

console.log('  TOTALS');
for (const t of ['timed_access_pass_grants', 'karaoke_apple_purchases', 'timed_access_pass_audit'])
  console.log(`    ${t.padEnd(28)} ${await count(t)}`);

const grants = await get(`timed_access_pass_grants?select=*&order=created_at.desc`);
const paid = grants.filter((g) => g.is_paid === true);
const mine = grants.filter((g) => g.account_id === ACCT);
const by = (rows, k) => rows.reduce((a, r) => ((a[r[k] ?? 'null'] = (a[r[k] ?? 'null'] ?? 0) + 1), a), {});
console.log('\n  GRANTS');
console.log(`    paid grants (is_paid=true)  ${paid.length}`);
console.log(`    by status (all)             ${JSON.stringify(by(grants, 'status'))}`);
console.log(`    controlled account grants   ${mine.length}  by status ${JSON.stringify(by(mine, 'status'))}`);
for (const g of mine.filter((g) => ['AVAILABLE', 'SELECTED', 'ACTIVE'].includes(g.status)))
  console.log(`      ${g.status.padEnd(9)} ${g.pass_type} ${g.duration_seconds}s paid=${g.is_paid} src=${g.source_type}`
    + ` sel=${g.selected_at ?? 'NULL'} act=${g.activated_at ?? 'NULL'} exp=${g.expires_at ?? 'NULL'}`
    + ` carryover=${g.carryover_seconds ?? 0} created=${g.created_at} grant#${gfp(g.id)}`);

console.log('\n  APPLE PURCHASES');
for (const p of await get('karaoke_apple_purchases?select=*&order=created_at.desc'))
  console.log(`    env=${p.environment} ${p.product_code} verify=${p.verification_status} grant=${p.grant_status}`
    + ` secs=${p.granted_seconds ?? '—'} txn#${fp(p.apple_transaction_id)} grantRef#${gfp(p.pass_grant_id)} ${p.created_at}`);

console.log('\n  AUDIT — most recent 5');
for (const a of await get('timed_access_pass_audit?select=*&order=created_at.desc&limit=5'))
  console.log(`    ${a.created_at} ${(a.action ?? a.event ?? '?')} ${(a.from_status ?? '')}->${(a.to_status ?? '')} acct#${fp(a.account_id)}`);
const acts = await get('timed_access_pass_audit?select=id&or=(action.eq.ACTIVATED,to_status.eq.ACTIVE)');
console.log(`    ACTIVATED-shaped rows (all time): ${Array.isArray(acts) ? acts.length : JSON.stringify(acts)}`);

console.log('\n  CONTROLLED ROOM');
const ev = await get(`karaoke_events?select=id,status,starts_at,created_at&room_id=eq.${ROOM}&order=created_at.desc&limit=5`);
console.log(`    events total listed ${ev.length}; draft/active = ${ev.filter((e) => ['draft', 'active'].includes(e.status)).length}`);
for (const e of ev) console.log(`      ${e.status} starts_at=${e.starts_at} event#${fp(e.id)}`);
const reqs = await get(`karaoke_requests?select=id,status&room_id=eq.${ROOM}`);
console.log(`    requests ever: ${Array.isArray(reqs) ? reqs.length : JSON.stringify(reqs)}`);

console.log('\n  LEASE / PLAYBACK-CHARGE COLUMNS — must stay NULL (E1: playback is unmetered)');
const songs = await get(`karaoke_requests?select=*&room_id=eq.${ROOM}&limit=1`);
const LEASE = ['lease_seconds', 'charged_window_start', 'charged_window_end', 'lease_opened_at', 'lease_closed_at'];
if (Array.isArray(songs) && songs[0]) {
  const present = LEASE.filter((c) => c in songs[0]);
  console.log(`    columns present: ${present.join(', ') || '(none)'} — values: ${present.map((c) => `${c}=${songs[0][c]}`).join(' ') || 'n/a'}`);
} else console.log('    no request rows in the controlled room yet (expected before §16)');
console.log();
