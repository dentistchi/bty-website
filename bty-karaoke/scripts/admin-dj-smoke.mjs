// Admin-as-DJ smoke — proves the canonical authorization: an Admin device token
// passes authorizeDj (queue read + mutations) while Admin-only routes still
// reject DJ tokens. Never prints tokens. Run against a THROWAWAY room.
//   node scripts/create-room.mjs karaoke-adj "Admin DJ"
//   node scripts/admin-dj-smoke.mjs karaoke-adj [baseUrl]

import { readFileSync } from 'node:fs';

const slug = process.argv[2];
const base = process.argv[3] || 'http://localhost:3002';
if (!slug) { console.error('Usage: node scripts/admin-dj-smoke.mjs <slug> [baseUrl]'); process.exit(1); }
const master = readFileSync(new URL(`../.dj-credential-${slug}.local`, import.meta.url), 'utf8').trim();

let pass = 0, fail = 0;
const ck = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };
const api = (p) => `${base}/api/rooms/${encodeURIComponent(slug)}${p}`;
const bearer = (t) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });
const j = (r) => r.json();

// Admin bootstrap → durable admin device token.
const admin = await fetch(api('/admin/verify'), { method: 'POST', headers: bearer(master) }).then(j);
const adminToken = admin.adminToken;
ck('admin bootstrap yields an admin device token', Boolean(adminToken));

// Admin token passes authorizeDj (DJ Console entry) WITHOUT pairing.
const q = await fetch(api('/dj/queue'), { headers: bearer(adminToken) });
const qb = await j(q);
ck('admin token passes authorizeDj (/dj/queue 200)', q.status === 200);
ck('queue payload reports role=admin', qb.role === 'admin', qb.role);

// Admin can drive the queue like a DJ.
await fetch(api('/admin/session'), { method: 'POST', headers: bearer(adminToken) });
const A = (await fetch(api('/requests'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guestName: 'Ann', youtubeVideoId: 'dQw4w9WgXcQ' }) }).then(j)).request.id;
ck('admin can START a song (play → 200)', (await fetch(api(`/requests/${A}`), { method: 'PATCH', headers: bearer(adminToken), body: JSON.stringify({ action: 'play' }) })).status === 200);
ck('admin can FINISH a song (complete → 200)', (await fetch(api(`/requests/${A}`), { method: 'PATCH', headers: bearer(adminToken), body: JSON.stringify({ action: 'complete' }) })).status === 200);

// Pair a real DJ device and confirm the split of authority.
const mint = await fetch(api('/admin/pair'), { method: 'POST', headers: bearer(adminToken), body: '{}' }).then(j);
const dj = await fetch(api('/dj/pair'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: new URL(mint.pairUrl).searchParams.get('token') }) }).then(j);
const djToken = dj.deviceToken;

ck('DJ token passes authorizeDj (/dj/queue 200)', (await fetch(api('/dj/queue'), { headers: bearer(djToken) })).status === 200);
ck('DJ token CANNOT mint pairing (admin-only → 401)', (await fetch(api('/admin/pair'), { method: 'POST', headers: bearer(djToken), body: '{}' })).status === 401);
ck('DJ token CANNOT rotate (admin-only → 401)', (await fetch(api('/admin/rotate'), { method: 'POST', headers: bearer(djToken) })).status === 401);
ck('DJ token CANNOT end the night (admin-only → 401)', (await fetch(api('/admin/session'), { method: 'DELETE', headers: bearer(djToken) })).status === 401);
ck('DJ token CANNOT list devices (admin-only → 401)', (await fetch(api('/admin/devices'), { headers: bearer(djToken) })).status === 401);
ck('DJ token CANNOT read admin session (Admin Console gate → 401)', (await fetch(api('/admin/session'), { headers: bearer(djToken) })).status === 401);

// Guest (no token) still fails authorizeDj.
ck('no-auth /dj/queue → 401', (await fetch(api('/dj/queue'))).status === 401);

// Rotate revokes DJ devices but keeps the admin device.
await fetch(api('/admin/rotate'), { method: 'POST', headers: bearer(adminToken) });
ck('after rotate: DJ token blocked (401)', (await fetch(api('/dj/queue'), { headers: bearer(djToken) })).status === 401);
ck('after rotate: admin token still works (200)', (await fetch(api('/dj/queue'), { headers: bearer(adminToken) })).status === 200);

console.log(`\n${fail === 0 ? '🎉 ADMIN-DJ SMOKE ALL PASS' : '⛔ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
