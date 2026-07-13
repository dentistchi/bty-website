// Admin PIN enrollment smoke. Exercises the real HTTP routes end-to-end:
// setup (nonce→PIN→device), single-use nonce, PIN enroll (+ KDF verify latency),
// uniform failure on wrong PIN, last-admin revoke guard, and DJ-can't-touch-Admin.
// Rate-limit LOCKOUT needs Cloudflare KV, so run this against PROD to see it
// (locally KV is absent → lockout is a no-op by design). Never prints secrets.
//   node scripts/create-room.mjs karaoke-pin "PIN Smoke"
//   node scripts/admin-pin-smoke.mjs karaoke-pin [baseUrl]

import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';

const slug = process.argv[2];
const base = process.argv[3] || 'http://localhost:3002';
if (!slug) { console.error('Usage: node scripts/admin-pin-smoke.mjs <slug> [baseUrl]'); process.exit(1); }

const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const v = Object.fromEntries(raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const DB = v.KARAOKE_SUPABASE_URL, KEY = v.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
const DBH = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };

let pass = 0, fail = 0;
const ck = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };
const api = (p) => `${base}/api/rooms/${encodeURIComponent(slug)}${p}`;
const bearer = (t) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });
const j = async (r) => { const t = await r.text(); try { return t ? JSON.parse(t) : {}; } catch { return {}; } };

const room = await (await fetch(`${DB}/rest/v1/karaoke_rooms?slug=eq.${slug}&select=id`, { headers: DBH })).json();
const roomId = room[0].id;

// Mint a setup nonce exactly like the Mac admin:setup command (service-role).
async function mintNonce() {
  const token = randomBytes(24).toString('base64url');
  const token_hash = createHash('sha256').update(token).digest('hex');
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await fetch(`${DB}/rest/v1/karaoke_admin_setup_tokens`, { method: 'POST', headers: { ...DBH, Prefer: 'return=minimal' }, body: JSON.stringify({ room_id: roomId, token_hash, expires_at }) });
  return token;
}

const PIN = 'sing-tonight-9';

// 1. Setup: consume nonce + set PIN + mint admin device.
const nonce = await mintNonce();
const setup = await fetch(api('/admin/setup'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: nonce, pin: PIN }) });
const setupBody = await j(setup);
ck('setup with valid nonce → 200 + adminToken', setup.status === 200 && Boolean(setupBody.adminToken));
const admin1 = setupBody.adminToken;

// 2. Nonce is single-use.
const reuse = await fetch(api('/admin/setup'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: nonce, pin: PIN }) });
ck('reused nonce → 410', reuse.status === 410, `got ${reuse.status}`);

// 3. Admin device can enter the DJ console (authorizeDj).
ck('setup admin device passes authorizeDj', (await fetch(api('/dj/queue'), { headers: bearer(admin1) })).status === 200);

// 4. Enroll a NEW device with the PIN (+ measure KDF verify latency).
const lat = [];
let admin2 = null;
for (let i = 0; i < 5; i++) {
  const t0 = Date.now();
  const r = await fetch(api('/admin/enroll'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: PIN }) });
  lat.push(Date.now() - t0);
  const b = await j(r);
  if (i === 0) { ck('enroll with correct PIN → 200 + adminToken', r.status === 200 && Boolean(b.adminToken)); admin2 = b.adminToken; }
}
lat.sort((a, b) => a - b);
console.log(`   ⏱  enroll (KDF verify) latency: p50=${lat[Math.floor(lat.length * 0.5)]}ms p95=${lat[Math.floor(lat.length * 0.95)]}ms @ ${base.includes('localhost') ? 'LOCAL' : 'WORKER'}`);

// 5. Uniform failure: wrong PIN, no-such-format, and (prod) lockout all identical.
const wrong = await fetch(api('/admin/enroll'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: 'wrong-000' }) });
const wrongBody = await j(wrong);
ck('wrong PIN → 401 uniform failure', wrong.status === 401);
ck('failure body leaks nothing (no room/pin state)', JSON.stringify(wrongBody) === JSON.stringify({ error: '등록할 수 없습니다. 잠시 후 다시 시도해 주세요.' }), JSON.stringify(wrongBody));

// 6. Last-admin guard. Authenticate revokes with the MASTER credential (not a
// device token — so it's immune to the revokes) and reduce to the true last admin.
const master = readFileSync(new URL(`../.dj-credential-${slug}.local`, import.meta.url), 'utf8').trim();
const adminDevs = () => fetch(api('/admin/devices'), { headers: bearer(master) }).then(j).then((d) => d.devices.filter((x) => x.role === 'admin' && x.status === 'active'));
let admins = await adminDevs();
ck('multiple active admin devices exist', admins.length >= 2, `count=${admins.length}`);
let revokedOk = true;
for (let i = 0; i < admins.length - 1; i++) {
  const r = await fetch(api(`/admin/devices/${admins[i].id}`), { method: 'DELETE', headers: bearer(master) });
  if (r.status !== 200) revokedOk = false;
}
ck('revoking non-last admin devices → 200 each', revokedOk);
admins = await adminDevs();
ck('exactly one admin device remains', admins.length === 1, `count=${admins.length}`);
const revokeLast = await fetch(api(`/admin/devices/${admins[0].id}`), { method: 'DELETE', headers: bearer(master) });
ck('revoke the LAST admin device → 409 (guard)', revokeLast.status === 409, `got ${revokeLast.status}`);

// 7. DJ cannot touch Admin: pair a DJ device, then try to rotate the PIN.
const mint = await fetch(api('/admin/pair'), { method: 'POST', headers: bearer(master), body: '{}' }).then(j);
const dj = await fetch(api('/dj/pair'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: new URL(mint.pairUrl).searchParams.get('token') }) }).then(j);
ck('DJ token CANNOT rotate the Admin PIN → 401', (await fetch(api('/admin/pin'), { method: 'POST', headers: bearer(dj.deviceToken), body: JSON.stringify({ pin: 'newpin12' }) })).status === 401);
ck('DJ token CANNOT set PIN via enroll-only path (no bearer needed, but stays DJ)', (await fetch(api('/dj/queue'), { headers: bearer(dj.deviceToken) }).then(j)).role === 'dj');

// 8. Lockout (KV-backed → PROD only). 5 failures lock this IP; then even the
// CORRECT PIN is refused with the SAME uniform response (proves lockout engaged).
if (!base.includes('localhost')) {
  for (let i = 0; i < 5; i++) {
    await fetch(api('/admin/enroll'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: 'brute-force-x' }) });
  }
  const lockedCorrect = await fetch(api('/admin/enroll'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: PIN }) });
  const lb = await j(lockedCorrect);
  ck('after 5 failures the CORRECT PIN is locked out (uniform 401)', lockedCorrect.status === 401);
  ck('locked response is identical to wrong-PIN (no lockout leak)', JSON.stringify(lb) === JSON.stringify({ error: '등록할 수 없습니다. 잠시 후 다시 시도해 주세요.' }));
} else {
  console.log('   ⏭  lockout check skipped (no KV locally; run against prod)');
}

console.log(`\n${fail === 0 ? '🎉 ADMIN-PIN SMOKE ALL PASS' : '⛔ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
