// Guest self-cancel smoke — proves the capability ownership model + status guard
// against the live DB. Never prints tokens. Run against a THROWAWAY room.
//   node scripts/create-room.mjs karaoke-cancel "Cancel Smoke"
//   node scripts/cancel-smoke.mjs karaoke-cancel [baseUrl]

import { readFileSync } from 'node:fs';

const slug = process.argv[2];
const base = process.argv[3] || 'http://localhost:3002';
if (!slug) { console.error('Usage: node scripts/cancel-smoke.mjs <slug> [baseUrl]'); process.exit(1); }
const master = readFileSync(new URL(`../.dj-credential-${slug}.local`, import.meta.url), 'utf8').trim();

let pass = 0, fail = 0;
const ck = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`); };
const api = (p) => `${base}/api/rooms/${encodeURIComponent(slug)}${p}`;
const bearer = (t) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });
const j = (r) => r.json();

const admin = await fetch(api('/admin/verify'), { method: 'POST', headers: bearer(master) }).then(j);
await fetch(api('/admin/session'), { method: 'POST', headers: bearer(admin.adminToken) });
const mint = await fetch(api('/admin/pair'), { method: 'POST', headers: bearer(admin.adminToken), body: '{}' }).then(j);
const token = new URL(mint.pairUrl).searchParams.get('token');
const dj = await fetch(api('/dj/pair'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }).then(j);
const djToken = dj.deviceToken;

async function submit(name, vid) {
  const b = await fetch(api('/requests'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guestName: name, youtubeVideoId: vid }) }).then(j);
  return { id: b.request.id, cancelToken: b.cancelToken };
}
const cancel = (id, tok) => fetch(api(`/requests/${id}/cancel`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok }) });

const A = await submit('Alice', 'dQw4w9WgXcQ');
const B = await submit('Bob', 'oHg5SJYRHA0');
ck('submit returns a cancel capability', Boolean(A.cancelToken) && Boolean(B.cancelToken));

// Cross-guest: B's token must not cancel A.
ck('another guest token cannot cancel (403)', (await cancel(A.id, B.cancelToken)).status === 403);
// Request id alone insufficient: empty/garbage token.
ck('garbage token cannot cancel (403)', (await cancel(A.id, 'not-a-token')).status === 403);
// Owner cancels A while waiting.
const okRes = await cancel(A.id, A.cancelToken);
const okBody = await j(okRes);
ck('owner cancels own waiting request (200 → removed)', okRes.status === 200 && okBody.status?.state === 'removed');
// Cancel A again → not twice.
ck('second cancel of same request does not re-cancel (409)', (await cancel(A.id, A.cancelToken)).status === 409);
// B recalculates to position 1 (A no longer counts).
const bStatus = await fetch(api(`/requests/${B.id}`)).then(j);
ck('cancelled request no longer counts toward positions (B → up_next)', bStatus.status?.state === 'up_next' && bStatus.status?.aheadCount === 0, JSON.stringify(bStatus.status));
// A gone from DJ queue.
const q = await fetch(api('/dj/queue'), { headers: bearer(djToken) }).then(j);
ck('cancelled request disappears from DJ queue', !q.requests.some((r) => r.id === A.id));
// Now-playing cannot cancel: start B, then try to cancel it.
await fetch(api(`/requests/${B.id}`), { method: 'PATCH', headers: bearer(djToken), body: JSON.stringify({ action: 'play' }) });
ck('now-playing request cannot be cancelled (409)', (await cancel(B.id, B.cancelToken)).status === 409);

console.log(`\n${fail === 0 ? '🎉 CANCEL SMOKE ALL PASS' : '⛔ CANCEL SMOKE FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
