// BUILD 26U-R4B-R1 — the purchase census. STRICTLY READ-ONLY.
//
// Run with a label BEFORE the tap and again AFTER it; the deltas are the evidence. It writes
// nothing, purchases nothing, activates nothing. Grant ids are TRUNCATED (8 chars, the same end
// and length the device's DEBUG label prints, so the two join by eye); Apple transaction ids,
// account ids and tokens are SHA-256 fingerprints and never appear in the clear.
//
// It persists BASELINE_GRANT_IDS to a file so the "exactly one new grant" test is an actual set
// difference against what was measured, not against what anyone remembered.
//
// Run:  npx tsx scripts/r4b-r1-census.mjs <label> [--save-baseline|--diff-baseline]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const vars = Object.fromEntries(
  raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const U = vars.KARAOKE_SUPABASE_URL, K = vars.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
const rpc = async (f, b = {}) =>
  (await fetch(`${U}/rest/v1/rpc/${f}`, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
const count = async (t, q = '') => {
  const r = await fetch(`${U}/rest/v1/${t}?select=id${q}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range');
  return cr ? Number(cr.split('/')[1]) : `UNREADABLE(${r.status})`;   // never a silent 0
};
const secret = (s) => (s ? createHash('sha256').update(String(s)).digest('hex').slice(0, 12) : '—');
const gfp = (s) => (s ? String(s).slice(0, 8) : '—');

const ACCT = '1a0be5e8-90e6-40b3-a26c-7b41be0a9a8c';
const ROOM = 'b28fc301-75e8-4f23-910f-37f6013f5b80';
const BASELINE_FILE = new URL('../.r4b-baseline.json', import.meta.url);
const label = process.argv[2] ?? 'unlabelled';
const mode = process.argv[3] ?? '';
const now = new Date().toISOString();

console.log(`\nBUILD 26U-R4B-R1 census — ${label}\nread at ${now}\n`);

console.log('  CONTAINMENT');
console.log(`    premium_room_mode      ${JSON.stringify(await rpc('karaoke_premium_room_mode'))}`);
const allow = await get('karaoke_premium_room_rollout?select=account_id,room_id');
console.log(`    allowlist              ${allow.length} pair(s)`);
const cat = await get('karaoke_product_catalog?select=product_code,is_active&order=display_order');
console.log(`    catalog                ${cat.map((r) => `${r.product_code}:${r.is_active}`).join('  ')}`);

console.log('\n  TOTALS');
const totals = {
  applePurchases: await count('karaoke_apple_purchases'),
  sandboxPurchases: await count('karaoke_apple_purchases', '&environment=eq.Sandbox'),
  grants: await count('timed_access_pass_grants'),
  paidGrants: await count('timed_access_pass_grants', '&is_paid=is.true'),
  audit: await count('timed_access_pass_audit'),
  activatedAudit: await count('timed_access_pass_audit', '&or=(action.eq.ACTIVATED,to_status.eq.ACTIVE)'),
};
for (const [k, v] of Object.entries(totals)) console.log(`    ${k.padEnd(22)} ${v}`);

const mine = await get(`timed_access_pass_grants?select=*&account_id=eq.${ACCT}&order=created_at.asc`);
const by = (st) => mine.filter((g) => g.status === st).length;
console.log('\n  CONTROLLED ACCOUNT');
console.log(`    AVAILABLE ${by('AVAILABLE')}   SELECTED ${by('SELECTED')}   ACTIVE ${by('ACTIVE')}`);

const avail1h = mine.filter((g) => g.status === 'AVAILABLE' && g.duration_seconds === 3600);
console.log(`\n  EVERY AVAILABLE ONE_HOUR GRANT (${avail1h.length})`);
for (const g of avail1h)
  console.log(`    ${gfp(g.id)}  ${String(g.source_type).padEnd(20)} paid=${String(g.is_paid).padEnd(5)}`
    + ` ${g.duration_seconds}s carry=${g.carryover_seconds ?? 0}`
    + ` sel=${g.selected_at ?? 'NULL'} act=${g.activated_at ?? 'NULL'} exp=${g.expires_at ?? 'NULL'}`
    + `  created=${g.created_at}`);

console.log('\n  CONTROLLED ROOM');
const ev = await get(`karaoke_events?select=id,status&room_id=eq.${ROOM}`);
console.log(`    events ${ev.length}  (draft/active ${ev.filter((e) => ['draft', 'active'].includes(e.status)).length})`);

console.log('\n  APPLE PURCHASES');
for (const p of await get('karaoke_apple_purchases?select=*&order=created_at.desc'))
  console.log(`    env=${p.environment} ${p.product_code} verify=${p.verification_status} grant=${p.grant_status}`
    + ` secs=${p.granted_seconds ?? '—'} txn#${secret(p.apple_transaction_id)} grantRef#${gfp(p.pass_grant_id)} ${p.created_at}`);

const ids = mine.map((g) => g.id);
if (mode === '--save-baseline') {
  writeFileSync(BASELINE_FILE, JSON.stringify({ at: now, totals, grantIds: ids }, null, 2));
  console.log(`\n  BASELINE_GRANT_IDS saved: ${ids.length} grant ids, pre-purchase timestamp ${now}`);
} else if (mode === '--diff-baseline') {
  if (!existsSync(BASELINE_FILE)) { console.log('\n  NO BASELINE FILE — cannot diff'); process.exit(2); }
  const base = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
  const baseSet = new Set(base.grantIds);
  const fresh = mine.filter((g) => !baseSet.has(g.id));
  console.log(`\n  SET DIFFERENCE vs baseline of ${base.grantIds.length} (taken ${base.at})`);
  console.log(`    NEW_GRANT_IDS count = ${fresh.length}   (must be exactly 1)`);
  for (const g of fresh) {
    const ok = g.source_type === 'PAID' && g.is_paid === true && g.status === 'AVAILABLE'
      && g.duration_seconds === 3600 && (g.carryover_seconds ?? 0) === 0
      && g.selected_at === null && g.activated_at === null && g.expires_at === null
      && g.created_at > base.at;
    console.log(`    ${gfp(g.id)}  ${g.source_type} paid=${g.is_paid} ${g.status} ${g.duration_seconds}s`
      + ` carry=${g.carryover_seconds ?? 0} sel=${g.selected_at} act=${g.activated_at} exp=${g.expires_at}`);
    console.log(`      created ${g.created_at} > baseline ${base.at}: ${g.created_at > base.at}`);
    console.log(`      ALL R4B-R1 §5 CONDITIONS: ${ok ? 'MET' : 'NOT MET'}`);
    console.log(`      != 006bc34f (the pre-existing paid grant): ${gfp(g.id) !== '006bc34f'}`);
  }
  console.log('\n  DELTAS vs baseline');
  for (const [k, v] of Object.entries(totals)) {
    const d = (typeof v === 'number' && typeof base.totals[k] === 'number') ? v - base.totals[k] : '?';
    console.log(`    ${k.padEnd(22)} ${base.totals[k]} -> ${v}   delta ${d >= 0 ? '+' : ''}${d}`);
  }
  const old = mine.find((g) => gfp(g.id) === '006bc34f');
  console.log(`\n  THE PRE-EXISTING PAID GRANT 006bc34f`);
  console.log(old ? `    ${old.status} sel=${old.selected_at} act=${old.activated_at} exp=${old.expires_at}`
                  : '    NOT FOUND — investigate before proceeding');
}
console.log();
