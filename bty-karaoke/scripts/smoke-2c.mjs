// STEP 2C live full-flow smoke. Drives the REAL server routes (which use the
// service-role client against the live DB) over HTTP. Proves admin bootstrap,
// session lifecycle, one-time pairing, concurrency safety, DJ persistence,
// authority boundaries, guest session gate, and rotate.
//
// Never prints credentials or raw device tokens.
//
// Usage:
//   node scripts/smoke-2c.mjs <slug> [baseUrl]
//     <slug>    a room whose master credential is in .dj-credential-<slug>.local
//     baseUrl   default http://localhost:3002
//
// Recommended: run against a THROWAWAY room, not production bty-home:
//   node scripts/create-room.mjs karaoke-smoke "Smoke Test"
//   node scripts/smoke-2c.mjs karaoke-smoke
//   node scripts/retire-room.mjs karaoke-smoke

import { readFileSync } from 'node:fs';

const slug = process.argv[2];
const base = process.argv[3] || 'http://localhost:3002';
if (!slug) {
  console.error('Usage: node scripts/smoke-2c.mjs <slug> [baseUrl]');
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

const api = (path) => `${base}/api/rooms/${encodeURIComponent(slug)}${path}`;
const bearer = (t) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });

async function json(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// ── 1. Admin bootstrap ─────────────────────────────────────────────────────
const vres = await fetch(api('/admin/verify'), { method: 'POST', headers: bearer(master) });
const vbody = await json(vres);
check('admin verify with master → 200', vres.status === 200, `got ${vres.status}`);
const adminToken = vbody.adminToken;
check('admin bootstrap returns a durable admin device token', Boolean(adminToken));
check(
  'master credential NOT echoed in verify response',
  !JSON.stringify(vbody).includes(master),
);
const badVerify = await fetch(api('/admin/verify'), {
  method: 'POST',
  headers: bearer('definitely-wrong-credential'),
});
check('invalid admin credential → 401', badVerify.status === 401, `got ${badVerify.status}`);

// ── 2. Session lifecycle ───────────────────────────────────────────────────
// Ensure a clean start: end any active session first.
await fetch(api('/admin/session'), { method: 'DELETE', headers: bearer(adminToken) });

// Concurrent start: fire two at once; both must resolve to the SAME active session.
const [s1, s2] = await Promise.all([
  fetch(api('/admin/session'), { method: 'POST', headers: bearer(adminToken) }).then(json),
  fetch(api('/admin/session'), { method: 'POST', headers: bearer(adminToken) }).then(json),
]);
const sid = s1.session?.id;
check('start room → active session created', Boolean(sid));
check(
  'concurrent start → exactly one active session (same id)',
  Boolean(sid) && s1.session?.id === s2.session?.id,
  `${s1.session?.id} vs ${s2.session?.id}`,
);
const getS = await fetch(api('/admin/session'), { headers: bearer(adminToken) }).then(json);
check('active session readable & singular', getS.session?.id === sid);

// ── 3. Pairing token (one-time + concurrency) ──────────────────────────────
const mint = await fetch(api('/admin/pair'), {
  method: 'POST',
  headers: bearer(adminToken),
  body: '{}',
}).then(json);
const token = mint.pairUrl ? new URL(mint.pairUrl).searchParams.get('token') : null;
check('admin mints pairing token + QR', Boolean(token) && typeof mint.qrSvg === 'string');

const redeem1 = await fetch(api('/dj/pair'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token }),
});
const redeem1Body = await json(redeem1);
const djToken = redeem1Body.deviceToken;
check('valid token redeem → 200 + device token', redeem1.status === 200 && Boolean(djToken));

const redeem2 = await fetch(api('/dj/pair'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token }),
});
check('second redeem of same token → 410', redeem2.status === 410, `got ${redeem2.status}`);

const badToken = await fetch(api('/dj/pair'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token: 'not-a-real-token' }),
});
const badTokenBody = await json(badToken);
check('invalid token → 410, no room/queue leak', badToken.status === 410 && !badTokenBody.room);

// Concurrent double-redeem of a FRESH token → exactly one winner.
const mint2 = await fetch(api('/admin/pair'), {
  method: 'POST',
  headers: bearer(adminToken),
  body: '{}',
}).then(json);
const token2 = new URL(mint2.pairUrl).searchParams.get('token');
const [r1, r2] = await Promise.all([
  fetch(api('/dj/pair'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: token2 }),
  }),
  fetch(api('/dj/pair'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: token2 }),
  }),
]);
const winners = [r1.status, r2.status].filter((s) => s === 200).length;
check('concurrent double-redeem → exactly one success', winners === 1, `winners=${winners}`);

// ── 4. DJ device persistence + authority boundaries ────────────────────────
const djVerify = await fetch(api('/dj/verify'), { method: 'POST', headers: bearer(djToken) });
check('DJ device verify → 200', djVerify.status === 200, `got ${djVerify.status}`);
const djQueue = await fetch(api('/dj/queue'), { headers: bearer(djToken) });
check('DJ device can read queue → 200', djQueue.status === 200, `got ${djQueue.status}`);

const djPair = await fetch(api('/admin/pair'), {
  method: 'POST',
  headers: bearer(djToken),
  body: '{}',
});
check('DJ device CANNOT mint pairing → 401', djPair.status === 401, `got ${djPair.status}`);
const djRotate = await fetch(api('/admin/rotate'), { method: 'POST', headers: bearer(djToken) });
check('DJ device CANNOT rotate → 401', djRotate.status === 401, `got ${djRotate.status}`);
const djSession = await fetch(api('/admin/session'), { method: 'POST', headers: bearer(djToken) });
check('DJ device CANNOT manage sessions → 401', djSession.status === 401, `got ${djSession.status}`);

// ── 5. Guest session gate ──────────────────────────────────────────────────
// A night is active (from step 2). Guest submit should succeed and be stamped.
const gRes = await fetch(api('/requests'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ guestName: 'SmokeGuest', youtubeVideoId: 'dQw4w9WgXcQ' }),
});
const gBody = await json(gRes);
check('guest submit while active → 201', gRes.status === 201, `got ${gRes.status}`);
check('request.session_id linked to active session', gBody.request?.session_id === sid);

// End the night → new submits blocked, history kept.
await fetch(api('/admin/session'), { method: 'DELETE', headers: bearer(adminToken) });
const gBlocked = await fetch(api('/requests'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ guestName: 'SmokeGuest2', youtubeVideoId: 'dQw4w9WgXcQ' }),
});
check('guest submit after night ended → 409', gBlocked.status === 409, `got ${gBlocked.status}`);
const histGet = await fetch(api('/requests'));
const hist = await json(histGet);
check('queue history preserved after end', Array.isArray(hist.requests) && hist.requests.length >= 1);

// ── 6. Rotate revokes DJ devices + burns tokens ────────────────────────────
const preRotateToken = new URL(
  (await fetch(api('/admin/pair'), { method: 'POST', headers: bearer(adminToken), body: '{}' }).then(
    json,
  )).pairUrl,
).searchParams.get('token');
const rotate = await fetch(api('/admin/rotate'), { method: 'POST', headers: bearer(adminToken) });
check('admin rotate → 200', rotate.status === 200, `got ${rotate.status}`);
const afterRotateQueue = await fetch(api('/dj/queue'), { headers: bearer(djToken) });
check('rotated DJ device now blocked → 401', afterRotateQueue.status === 401, `got ${afterRotateQueue.status}`);
const staleRedeem = await fetch(api('/dj/pair'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token: preRotateToken }),
});
check('outstanding token burned by rotate → 410', staleRedeem.status === 410, `got ${staleRedeem.status}`);

// Admin token survives rotate (admin devices are not revoked).
const adminStillOk = await fetch(api('/admin/session'), { headers: bearer(adminToken) });
check('admin device still authorized after rotate', adminStillOk.status === 200, `got ${adminStillOk.status}`);

// ── Result ─────────────────────────────────────────────────────────────────
console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⛔ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
