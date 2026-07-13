// DJ queue action smoke — proves move_next (먼저 부르기) reorder + remove (곡 빼기)
// against the live DB, incl. auth and status guards. No browser-native dialogs
// are involved server-side. Run against a THROWAWAY room. Never prints tokens.
//   node scripts/create-room.mjs karaoke-dj "DJ Smoke"
//   node scripts/dj-reorder-smoke.mjs karaoke-dj [baseUrl]

import { readFileSync } from 'node:fs';

const slug = process.argv[2];
const base = process.argv[3] || 'http://localhost:3002';
if (!slug) { console.error('Usage: node scripts/dj-reorder-smoke.mjs <slug> [baseUrl]'); process.exit(1); }
const master = readFileSync(new URL(`../.dj-credential-${slug}.local`, import.meta.url), 'utf8').trim();

let pass = 0, fail = 0;
const ck = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };
const api = (p) => `${base}/api/rooms/${encodeURIComponent(slug)}${p}`;
const bearer = (t) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });
const j = (r) => r.json();

const admin = await fetch(api('/admin/verify'), { method: 'POST', headers: bearer(master) }).then(j);
await fetch(api('/admin/session'), { method: 'POST', headers: bearer(admin.adminToken) });
const mint = await fetch(api('/admin/pair'), { method: 'POST', headers: bearer(admin.adminToken), body: '{}' }).then(j);
const dj = await fetch(api('/dj/pair'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: new URL(mint.pairUrl).searchParams.get('token') }) }).then(j);
const djT = dj.deviceToken;

async function submit(name, vid) {
  const b = await fetch(api('/requests'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guestName: name, youtubeVideoId: vid }) }).then(j);
  return b.request.id;
}
const patch = (id, action, tok = djT) => fetch(api(`/requests/${id}`), { method: 'PATCH', headers: tok ? bearer(tok) : { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
const guestStatus = (id) => fetch(api(`/requests/${id}`)).then(j).then((x) => x.status);
const queueIds = async () => (await fetch(api('/dj/queue'), { headers: bearer(djT) }).then(j)).requests.filter((r) => r.status === 'waiting').map((r) => r.id);

const A = await submit('Anna', 'dQw4w9WgXcQ');
const B = await submit('Bob', 'oHg5SJYRHA0');
const C = await submit('Cara', 'y6120QOlsfU');
const D = await submit('Dan', '9bZkp7q19f0');
await patch(A, 'play'); // A on stage

// move D to the front of the waiting line.
ck('move_next → 200', (await patch(D, 'move_next')).status === 200);
const order = await queueIds();
ck('waiting order becomes D, B, C', JSON.stringify(order) === JSON.stringify([D, B, C]), order.join(','));
const cur = (await fetch(api('/dj/queue'), { headers: bearer(djT) }).then(j)).requests.find((r) => r.status === 'playing');
ck('currently playing song is unchanged (A)', cur?.id === A);
const dStat = await guestStatus(D);
ck('moved request is up_next for its guest', dStat.state === 'up_next' && dStat.aheadCount === 0, JSON.stringify(dStat));
const bStat = await guestStatus(B);
ck('other guest positions recalculated (B → 2)', bStat.position === 2, JSON.stringify(bStat));

// remove B (곡 빼기).
ck('remove waiting → 200', (await patch(B, 'remove')).status === 200);
ck('removed request gone from DJ queue', !(await queueIds()).includes(B));
ck('removed request status is removed for its guest', (await guestStatus(B)).state === 'removed');
ck('positions recalc after remove (C → 2)', (await guestStatus(C)).position === 2);

// guards
ck('now-playing cannot be removed (409)', (await patch(A, 'remove')).status === 409);
ck('unauthenticated move_next → 401', (await patch(C, 'move_next', null)).status === 401);
ck('unauthenticated remove → 401', (await patch(C, 'remove', null)).status === 401);

console.log(`\n${fail === 0 ? '🎉 DJ SMOKE ALL PASS' : '⛔ DJ SMOKE FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
