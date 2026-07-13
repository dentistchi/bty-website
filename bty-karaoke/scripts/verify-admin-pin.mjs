// Read-only live verification of the Admin-PIN enrollment schema, via the
// service-role PostgREST client. Confirms columns, the isolated setup-token
// table, and that redeem_admin_setup is callable by service_role and returns
// NULL (no mutation) for a nonexistent token. Catalog-level facts (RLS flag,
// grants, search_path) are verified separately in the SQL Editor.
// Never prints secrets. Usage: node scripts/verify-admin-pin.mjs

import { readFileSync } from 'node:fs';

const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const v = Object.fromEntries(
  raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const U = v.KARAOKE_SUPABASE_URL, K = v.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'content-type': 'application/json' };

let pass = 0, fail = 0;
const ck = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };

async function get(path) {
  const r = await fetch(`${U}/rest/v1/${path}`, { headers: { ...H, Prefer: 'count=exact' } });
  return r;
}

// 1-2. PIN columns exist on karaoke_rooms
const cols = await get('karaoke_rooms?select=admin_pin_hash,admin_pin_updated_at&limit=0');
ck('karaoke_rooms.admin_pin_hash + admin_pin_updated_at exist', cols.ok, `HTTP ${cols.status}`);

// 3. Isolated setup-token table exists
const tbl = await get('karaoke_admin_setup_tokens?select=id,room_id,token_hash,expires_at,redeemed_at,redeemed_device_id&limit=0');
ck('karaoke_admin_setup_tokens exists', tbl.ok, `HTTP ${tbl.status}`);
const tokenCountBefore = tbl.headers.get('content-range')?.split('/')[1] ?? '?';

// 6/7. service_role can CALL redeem_admin_setup; a nonexistent token → null, no mutation.
const fakeRoom = '00000000-0000-0000-0000-000000000000';
const rpc = await fetch(`${U}/rest/v1/rpc/redeem_admin_setup`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({
    p_room_id: fakeRoom,
    p_token_hash: 'nonexistent-token-hash',
    p_pin_hash: 'pbkdf2_sha256$1$x$x',
    p_device_label: 'probe',
    p_device_token_hash: 'probe-hash',
  }),
});
const rpcBody = await rpc.text();
ck('service_role can execute redeem_admin_setup', rpc.ok, `HTTP ${rpc.status}`);
ck('nonexistent token → returns null', rpc.ok && (rpcBody === 'null' || rpcBody === ''), `body=${rpcBody.slice(0, 40)}`);

// No mutation: no setup-token rows created, no device minted for the fake room, PIN not set.
const tokenCountAfter = (await get('karaoke_admin_setup_tokens?select=id&limit=0')).headers.get('content-range')?.split('/')[1] ?? '?';
ck('no setup-token rows created by the probe', tokenCountBefore === tokenCountAfter, `${tokenCountBefore} → ${tokenCountAfter}`);
const fakeDevices = (await get(`karaoke_dj_devices?room_id=eq.${fakeRoom}&select=id&limit=0`)).headers.get('content-range')?.split('/')[1] ?? '?';
ck('no admin device minted for the fake room', fakeDevices === '0', `count=${fakeDevices}`);

console.log(`\n${fail === 0 ? '🎉 SERVICE-ROLE CHECKS PASS' : '⛔ FAILURES'} — ${pass} passed, ${fail} failed`);
console.log('(catalog facts — RLS flag / grants / search_path — verified via the SQL Editor query below)');
process.exit(fail === 0 ? 0 : 1);
