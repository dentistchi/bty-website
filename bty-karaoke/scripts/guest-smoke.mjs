// Guest live-status smoke — drives the REAL guest routes against the live DB to
// prove the STEP 8 guest-status contract that GuestStatusCard polls:
//   submit → queued position → up_next → now_playing → done, session gate, and
//   cross-room / invalid isolation (no status leak).
//
// UI-only items (card renders, polling resumes visually after reload) are device
// checks; this proves the server contract the UI depends on.
//
// Never prints credentials or device tokens. Run against a THROWAWAY room.
//   node scripts/create-room.mjs karaoke-guest "Guest Smoke"
//   node scripts/guest-smoke.mjs karaoke-guest [baseUrl]

import { readFileSync } from 'node:fs';

const slug = process.argv[2];
const base = process.argv[3] || 'http://localhost:3002';
if (!slug) {
  console.error('Usage: node scripts/guest-smoke.mjs <slug> [baseUrl]');
  process.exit(1);
}
const master = readFileSync(new URL(`../.dj-credential-${slug}.local`, import.meta.url), 'utf8').trim();

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`✅ ${name}`);
  } else {
    fail++;
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
const api = (s, p) => `${base}/api/rooms/${encodeURIComponent(s)}${p}`;
const bearer = (t) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });
const j = (r) => r.json();

// Admin bootstrap + start the night (guest submit is gated on an active session).
const admin = await fetch(api(slug, '/admin/verify'), { method: 'POST', headers: bearer(master) }).then(j);
const adminToken = admin.adminToken;
// Pair a DJ device to drive stage transitions.
await fetch(api(slug, '/admin/session'), { method: 'POST', headers: bearer(adminToken) });
const mint = await fetch(api(slug, '/admin/pair'), { method: 'POST', headers: bearer(adminToken), body: '{}' }).then(j);
const token = new URL(mint.pairUrl).searchParams.get('token');
const dj = await fetch(api(slug, '/dj/pair'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) }).then(j);
const djToken = dj.deviceToken;

// 1. Submit → confirmation payload with a live position.
const sub1 = await fetch(api(slug, '/requests'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ guestName: 'Alice', youtubeVideoId: 'dQw4w9WgXcQ', youtubeTitle: 'Song A' }),
});
const b1 = await j(sub1);
const id1 = b1.request?.id;
check('guest submit → 201 with request', sub1.status === 201 && Boolean(id1));
check('confirmation carries a live status + position', Boolean(b1.status) && typeof b1.status.position === 'number');
check('first request resolves up_next (nobody ahead)', b1.status?.state === 'up_next' && b1.status?.aheadCount === 0, JSON.stringify(b1.status));

// 2. Second guest → position 2, waiting; first stays up_next.
const sub2 = await fetch(api(slug, '/requests'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ guestName: 'Bob', youtubeVideoId: 'oHg5SJYRHA0', youtubeTitle: 'Song B' }),
});
const b2 = await j(sub2);
const id2 = b2.request?.id;
check('second request → waiting at position 2', b2.status?.state === 'waiting' && b2.status?.position === 2, JSON.stringify(b2.status));

// 3. Polling endpoint (what GuestStatusCard hits) returns the same live status.
const poll1 = await fetch(api(slug, `/requests/${id1}`)).then(j);
check('poll #1 status readable (queued position shown)', poll1.status?.state === 'up_next' && poll1.status?.position === 1, JSON.stringify(poll1.status));
const poll2 = await fetch(api(slug, `/requests/${id2}`)).then(j);
check('poll #2 shows position 2 while waiting', poll2.status?.position === 2);

// 4. DJ starts request 1 → now_playing.
await fetch(api(slug, `/requests/${id1}`), { method: 'PATCH', headers: bearer(djToken), body: JSON.stringify({ action: 'play' }) });
const playing = await fetch(api(slug, `/requests/${id1}`)).then(j);
check('after DJ start → now_playing', playing.status?.state === 'now_playing' && playing.status?.isNowPlaying === true, JSON.stringify(playing.status));
// Request 2 should now be up_next (nobody waiting ahead; the playing one isn't "ahead in line").
const b2now = await fetch(api(slug, `/requests/${id2}`)).then(j);
check('waiting song becomes up_next while another plays', b2now.status?.state === 'up_next' && b2now.status?.aheadCount === 0, JSON.stringify(b2now.status));

// 5. DJ finishes request 1 → done.
await fetch(api(slug, `/requests/${id1}`), { method: 'PATCH', headers: bearer(djToken), body: JSON.stringify({ action: 'complete' }) });
const done = await fetch(api(slug, `/requests/${id1}`)).then(j);
check('after DJ finish → done', done.status?.state === 'done', JSON.stringify(done.status));

// 6. Session end → new submit blocked; existing status still readable.
await fetch(api(slug, '/admin/session'), { method: 'DELETE', headers: bearer(adminToken) });
const blocked = await fetch(api(slug, '/requests'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ guestName: 'Carol', youtubeVideoId: 'dQw4w9WgXcQ' }),
});
check('submit after night ended → 409', blocked.status === 409, `got ${blocked.status}`);
const stillReadable = await fetch(api(slug, `/requests/${id2}`));
check('existing request status still readable after end', stillReadable.status === 200);

// 7. Isolation: another room cannot read this room's request status; invalid id → 404.
const other = 'karaoke-guest-other';
try {
  const crossHttp = await fetch(api(other, `/requests/${id1}`));
  check('cross-room status request → 404 (no leak)', crossHttp.status === 404, `got ${crossHttp.status}`);
} catch {
  check('cross-room status request → 404 (no leak)', false, 'fetch threw');
}
const bogus = await fetch(api(slug, `/requests/00000000-0000-0000-0000-000000000000`));
check('invalid request id → 404 (no leak)', bogus.status === 404, `got ${bogus.status}`);

console.log(`\n${fail === 0 ? '🎉 GUEST SMOKE ALL PASS' : '⛔ GUEST SMOKE FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
