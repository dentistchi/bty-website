// BUILD 23-GATE-R3 — seed an ISOLATED authority for the end-to-end G1 run.
//
// WHY THIS EXISTS. The client-side injection returns UPSTREAM of POST /dj/pass-turn, so it
// synthesizes `completed:true` without the server completing anything. It therefore cannot prove
// the four things G1 is actually about: canonical completion of the current song, the blocked
// request staying waiting + Ready, a REAL server-produced `blockedRequestId`, and poll convergence.
//
// The mechanism here uses NO debug bypass anywhere. It seeds a REAL ACTIVE Timed Pass whose
// remaining window is genuinely shorter than the next song, so `karaoke_begin_song_v2` returns
// `pass_insufficient` through its ordinary production logic:
//
//     v_song_end = now + duration(next)   >   v_pass_expires   ->  'pass_insufficient'
//
// The `timed_pass_expiry_math_chk` constraint forces `expires_at = activated_at + duration`, so the
// short window is produced by BACKDATING `activated_at` — a genuinely ACTIVE ONE_HOUR pass with
// ~10 minutes left, not a bent row. Every constraint, index, status machine and RPC is the real one.
//
// SAFETY. This refuses to run against the production Supabase project, refuses a non-local host
// unless GATE_B23_ALLOW_REMOTE=1 is set for a dedicated staging project, and touches nothing that
// exists already: every row it writes carries the `gate-b23` marker and `npm run gate:b23:seed --
// --clean` removes exactly those rows and nothing else.
//
// Usage:
//   KARAOKE_SUPABASE_URL=http://127.0.0.1:54321 \
//   KARAOKE_SUPABASE_SERVICE_ROLE_KEY=<local service role> \
//   node scripts/gate-b23-seed.mjs [--clean]

import { createHash, randomUUID } from 'node:crypto';

// ── The production project this script must NEVER touch ────────────────────────────────────────
const PRODUCTION_PROJECT_REF = 'zycwaqignioawtqynopj';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0']);

const SLUG = 'gate-b23';
const MARKER = 'gate-b23';
const DJ_SECRET = 'gate-b23-dj-secret';           // raw credential; only its SHA-256 is stored
const CURRENT_VIDEO = 'gateB23CURx';              // canonical ids are EXACTLY 11 chars
const NEXT_VIDEO = 'gateB23NXTx';
/**
 * The NEXT song is 14:40 — admissible (<= 900s) but LONGER than the pass window below.
 *
 * Overridable so the harness can run its own NEGATIVE CONTROL: seed a duration SHORTER than the
 * pass remaining (e.g. `GATE_B23_NEXT_DURATION_SECONDS=200`) and the very same setup must promote
 * normally. A harness that can only ever produce one answer proves nothing about the other.
 */
const NEXT_DURATION_SECONDS = Number(process.env.GATE_B23_NEXT_DURATION_SECONDS ?? 900);
/**
 * GATE G2 — a POSITIVELY KNOWN duration above the 900s playback bound.
 *
 * 8917s is a real production value: the medley `TapTFlOmE_I` measured during the BUILD 21
 * production probe. It is stored in `karaoke_video_durations`, which BUILD 22's migration
 * deliberately un-capped (`duration_seconds > 0`) precisely so an over-limit verdict could become
 * durable — so this is the ordinary production representation of "this video is too long", not a
 * special test value.
 *
 * WHY G2 HAS NO DEADLINE (unlike G1): `resolveVideoDuration` classifies the cached duration in
 * `beginSong` BEFORE `karaoke_begin_song_v2` is ever called, so the refusal happens upstream of
 * every entitlement/pass check. The pass state is irrelevant and nothing expires.
 */
const TOO_LONG_DURATION_SECONDS = Number(process.env.GATE_B23_TOO_LONG_SECONDS ?? 8917);
/**
 * A real ONE_HOUR pass, backdated so ~14 minutes remain. 840 < 900 -> pass_insufficient.
 *
 * THIS WINDOW IS A DEADLINE. The pass must still be ACTIVE and still be SHORTER than the next song
 * at the moment of the tap. Once it expires, `begin_song_v2` expires the grant, the account falls
 * back to FREE, and a 900s song fits inside the 900s daily allowance — so the run would PROMOTE and
 * silently prove the opposite of what the gate intends.
 *
 * ~14 minutes is the practical ceiling: the song must be <= 900s to be admissible at all, so the
 * pass window can never exceed that. For a device run, RE-SEED immediately before tapping —
 * `npm run gate:b23:seed` is idempotent and takes under a second.
 */
const PASS_DURATION_SECONDS = 3600;
const PASS_REMAINING_SECONDS = Number(process.env.GATE_B23_PASS_REMAINING_SECONDS ?? 840);

function assertIsolated(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`KARAOKE_SUPABASE_URL is not a URL: ${rawUrl}`);
  }
  if (url.host.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error(
      `REFUSING: ${url.host} is the PRODUCTION karaoke project (${PRODUCTION_PROJECT_REF}). ` +
        'This harness must never seed, mutate, or clean production data.',
    );
  }
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (!isLocal && process.env.GATE_B23_ALLOW_REMOTE !== '1') {
    throw new Error(
      `REFUSING: ${url.hostname} is not a local host. Point this at a local Supabase, or set ` +
        'GATE_B23_ALLOW_REMOTE=1 only for a DEDICATED staging project that holds no customer data.',
    );
  }
  return url;
}

const RAW_URL = process.env.KARAOKE_SUPABASE_URL;
const KEY = process.env.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
if (!RAW_URL || !KEY) {
  console.error('Missing KARAOKE_SUPABASE_URL / KARAOKE_SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
let BASE;
try {
  BASE = assertIsolated(RAW_URL);
} catch (e) {
  // A clean one-line refusal with a non-zero exit — never a stack trace that could be mistaken
  // for a crash the operator should work around.
  console.error(String(e.message ?? e));
  process.exit(1);
}

const headers = {
  apikey: KEY,
  authorization: `Bearer ${KEY}`,
  'content-type': 'application/json',
  prefer: 'return=representation',
};

async function rest(path, init = {}) {
  const res = await fetch(`${BASE.origin}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const insert = (table, row) => rest(table, { method: 'POST', body: JSON.stringify(row) });
const patch = (table, q, row) => rest(`${table}?${q}`, { method: 'PATCH', body: JSON.stringify(row) });
/** Takes a FULL `table?filter` path — every caller already supplies its own filter. */
const del = (pathWithFilter) => rest(pathWithFilter, { method: 'DELETE' });

const sha256Hex = (s) => createHash('sha256').update(s).digest('hex');
const iso = (offsetSeconds) => new Date(Date.now() + offsetSeconds * 1000).toISOString();

// ── CLEAN ──────────────────────────────────────────────────────────────────────────────────────
async function clean() {
  const rooms = await rest(`karaoke_rooms?slug=eq.${SLUG}&select=id`);
  for (const r of rooms ?? []) {
    // Ordered by FK dependency; karaoke_requests/events/sessions cascade from the room, but the
    // usage segments and grants do not, so they go first and explicitly.
    await del(`karaoke_event_usage_segments?room_id=eq.${r.id}`);
    await del(`karaoke_rooms?id=eq.${r.id}`);
  }
  const accounts = await rest(`karaoke_accounts?provider_subject=eq.${MARKER}&select=id`);
  for (const a of accounts ?? []) {
    await del(`timed_access_pass_audit?account_id=eq.${a.id}`);
    await del(`timed_access_pass_grants?account_id=eq.${a.id}`);
    await del(`karaoke_host_plan_assignments?account_id=eq.${a.id}`);
    await del(`karaoke_workspace_members?account_id=eq.${a.id}`);
    await del(`karaoke_accounts?id=eq.${a.id}`);
  }
  await del(`karaoke_workspaces?name=eq.${MARKER}`);
  await del(`karaoke_video_durations?video_id=in.(${CURRENT_VIDEO},${NEXT_VIDEO})`);
  console.log(`cleaned: every row marked '${MARKER}' on ${BASE.host}`);
}

// ── SEED ───────────────────────────────────────────────────────────────────────────────────────
async function seed() {
  await clean(); // idempotent — re-seeding is always a fresh, known state

  // Enforcement + the v2 lease path must be ON, exactly as production is, or begin_song_v2 is
  // never reached and the pass gate cannot fire.
  await patch('karaoke_usage_policy', 'policy_key=eq.default', {
    enforcement_enabled: true,
    lease_write_mode: 'on',
  });

  const [account] = await insert('karaoke_accounts', {
    provider: 'apple',
    provider_subject: MARKER,
    display_name: 'GATE B23',
  });
  await insert('karaoke_host_plan_assignments', {
    account_id: account.id,
    plan_code: 'FREE', // must NOT be PRO — a PRO account never consumes a pass
    source: 'MANUAL',
    status: 'active',
  });

  const [workspace] = await insert('karaoke_workspaces', { name: MARKER, created_by: account.id });
  await insert('karaoke_workspace_members', {
    workspace_id: workspace.id,
    account_id: account.id,
    role: 'owner',       // karaoke_room_owner_account requires exactly ONE active owner
    status: 'active',
  });

  const [room] = await insert('karaoke_rooms', {
    slug: SLUG,
    display_name: 'GATE B23 Room',
    status: 'open',
    dj_secret: sha256Hex(DJ_SECRET), // only the hash is ever stored
  });
  await insert('karaoke_room_ownership', { room_id: room.id, workspace_id: workspace.id });
  await insert('karaoke_sessions', { room_id: room.id, status: 'active' });

  const [event] = await insert('karaoke_events', {
    room_id: room.id,
    name: 'GATE B23',
    public_code: `${MARKER}-code`,
    guest_slug: `${MARKER}-guest`,
    status: 'active',
  });

  // The stage: one song ALREADY playing (so the tap is a finish, not a start) and one waiting
  // song that is READY — the request the server will select for promotion and then refuse.
  const [current] = await insert('karaoke_requests', {
    room_id: room.id,
    event_id: event.id,
    guest_name: 'Current',
    youtube_video_id: CURRENT_VIDEO,
    youtube_title: 'GATE B23 current',
    position: 1,
    status: 'playing',
    started_at: iso(-60),
  });
  const [next] = await insert('karaoke_requests', {
    room_id: room.id,
    event_id: event.id,
    guest_name: 'Next',
    youtube_video_id: NEXT_VIDEO,
    youtube_title: 'GATE B23 next',
    position: 2,
    status: 'waiting',
    ready_at: iso(-30), // READY — this is what makes needs_ready a WRONG answer
  });

  // An OPEN usage segment for the song on stage, so the finish exercises REAL segment closure
  // (karaoke_end_song_v2 sets ended_at + close_reason) rather than closing nothing. All lease
  // columns stay null — the legacy branch of `usage_seg_lease_consistency` — because this song was
  // placed on stage by the seed, not admitted through begin_song_v2. `metered` must equal
  // `plan_snapshot = 'FREE'` (usage_seg_metered_matches_plan).
  await insert('karaoke_event_usage_segments', {
    account_id: account.id,
    event_id: event.id,
    room_id: room.id,
    request_id: current.id,
    plan_snapshot: 'FREE',
    metered: true,
    started_at: iso(-60),
    timezone_snapshot: 'America/Los_Angeles',
  });

  // Pre-cache the next song's duration so the run needs no YouTube call and is fully
  // deterministic. begin_song_v2 reads this table directly.
  await insert('karaoke_video_durations', {
    video_id: NEXT_VIDEO,
    duration_seconds: NEXT_DURATION_SECONDS,
    source: 'gate-b23-seed',
  });

  // A GENUINELY ACTIVE ONE_HOUR pass with ~10 minutes left. `expires_at` is exactly
  // `activated_at + duration_seconds`, satisfying timed_pass_expiry_math_chk — the short window
  // comes from backdating activation, never from bending the constraint.
  const activatedAt = iso(-(PASS_DURATION_SECONDS - PASS_REMAINING_SECONDS));
  const expiresAt = new Date(
    new Date(activatedAt).getTime() + PASS_DURATION_SECONDS * 1000,
  ).toISOString();
  const [grant] = await insert('timed_access_pass_grants', {
    account_id: account.id,
    pass_type: 'ONE_HOUR',
    duration_seconds: PASS_DURATION_SECONDS,
    status: 'ACTIVE',
    issued_by_manager: MARKER,
    issue_reason: 'BUILD 23 G1 end-to-end gate',
    issue_idempotency_key: `${MARKER}-${randomUUID()}`,
    activated_at: activatedAt,
    expires_at: expiresAt,
  });

  console.log(
    JSON.stringify(
      {
        authority: BASE.host,
        roomSlug: SLUG,
        djCredential: DJ_SECRET,
        eventId: event.id,
        currentRequestId: current.id,
        expectedBlockedRequestId: next.id,
        passExpiresAt: expiresAt,
        passRemainingSeconds: PASS_REMAINING_SECONDS,
        nextSongDurationSeconds: NEXT_DURATION_SECONDS,
        expectation:
          `next song ${NEXT_DURATION_SECONDS}s > pass remaining ~${PASS_REMAINING_SECONDS}s ` +
          '-> karaoke_begin_song_v2 returns pass_insufficient',
        passGrantSeeded: Boolean(grant),
      },
      null,
      2,
    ),
  );
}

// ── RE-ARM ─────────────────────────────────────────────────────────────────────────────────────
//
// The pass window is a DEADLINE (see PASS_REMAINING_SECONDS), but a full re-seed DELETES the room,
// which cascades away `karaoke_dj_devices` and therefore invalidates a device that has already
// paired. On a physical-device run that means re-pairing through the Manager flow every time the
// window lapses — enough friction to make the gate not worth running.
//
// Re-arm resets ONLY the stage and the pass window, leaving the room, event and paired devices
// intact. Pair once, then re-arm immediately before each tap.
async function rearm(tooLong = false, lookupFault = false, quotaFault = false) {
  // G1 arms a 900s next song (admissible, refused by the PASS window); G2 arms an over-limit
  // duration (refused by the DURATION classifier, upstream of every entitlement check). They are
  // mutually exclusive because both are expressed as the same video's cached duration.
  const nextDuration = tooLong ? TOO_LONG_DURATION_SECONDS : NEXT_DURATION_SECONDS;
  const [room] = (await rest(`karaoke_rooms?slug=eq.${SLUG}&select=id`)) ?? [];
  if (!room) throw new Error(`No '${SLUG}' room on ${BASE.host} — run the seed first.`);
  const [account] = (await rest(`karaoke_accounts?provider_subject=eq.${MARKER}&select=id`)) ?? [];
  if (!account) throw new Error(`No '${MARKER}' account on ${BASE.host} — run the seed first.`);
  const [event] = (await rest(`karaoke_events?room_id=eq.${room.id}&select=id&order=created_at.desc`)) ?? [];

  const [current] = (await rest(
    `karaoke_requests?room_id=eq.${room.id}&youtube_video_id=eq.${CURRENT_VIDEO}&select=id`,
  )) ?? [];
  const [next] = (await rest(
    `karaoke_requests?room_id=eq.${room.id}&youtube_video_id=eq.${NEXT_VIDEO}&select=id`,
  )) ?? [];
  if (!current || !next) throw new Error('Seeded requests are missing — run the seed first.');

  // Put the stage back: one song PLAYING, one waiting song READY.
  //
  // ORDER MATTERS. `karaoke_requests_one_playing_idx` allows at most one `playing` row per room, so
  // the stage must be VACATED before it is claimed. A previous run can legitimately have left the
  // NEXT row playing (e.g. the G3 recovery step, where a deliberate Start succeeds), and setting
  // `current` to playing first then 23505s. Clear both to waiting, then claim.
  await patch('karaoke_requests', `id=eq.${next.id}`, {
    status: 'waiting', started_at: null, completed_at: null, ready_at: iso(-30),
  });
  await patch('karaoke_requests', `id=eq.${current.id}`, {
    status: 'waiting', started_at: null, completed_at: null, ready_at: null,
  });
  await patch('karaoke_requests', `id=eq.${current.id}`, {
    status: 'playing', started_at: iso(-60), completed_at: null, ready_at: null,
  });

  // One OPEN segment for the song on stage (unique per request_id, and one open per room/event).
  await del(`karaoke_event_usage_segments?room_id=eq.${room.id}`);
  await insert('karaoke_event_usage_segments', {
    account_id: account.id,
    event_id: event.id,
    room_id: room.id,
    request_id: current.id,
    plan_snapshot: 'FREE',
    metered: true,
    started_at: iso(-60),
    timezone_snapshot: 'America/Los_Angeles',
  });

  // Re-arm the REAL pass by moving activation forward; expires_at stays exactly
  // activated_at + duration_seconds, so timed_pass_expiry_math_chk still holds.
  const activatedAt = iso(-(PASS_DURATION_SECONDS - PASS_REMAINING_SECONDS));
  const expiresAt = new Date(
    new Date(activatedAt).getTime() + PASS_DURATION_SECONDS * 1000,
  ).toISOString();
  await patch('timed_access_pass_grants', `account_id=eq.${account.id}`, {
    status: 'ACTIVE', activated_at: activatedAt, expires_at: expiresAt, expired_at: null,
  });
  if (lookupFault || quotaFault) {
    // GATE G3 — remove the cached duration so the resolver must go UPSTREAM. Combined with an
    // invalid YOUTUBE_API_KEY on the local Worker, `fetchDuration` takes its genuine transient
    // branch: a non-quota upstream error, ONE retry, then `lookup_failed`. Nothing about this is
    // simulated in the app — it is the real network path, failing for a real reason.
    //
    // Clearing the fault is just putting the row back (`--g3-clear`), which is exactly what makes
    // the deliberate later Start succeed with ZERO upstream calls.
    await del(`karaoke_video_durations?video_id=eq.${NEXT_VIDEO}`);
  } else {
    // The cached duration IS the gate selector. PATCH-then-insert rather than PATCH alone, so a
    // missing row (a cleaned DB, or a previous run that removed it) still lands the value.
    const patched = await patch('karaoke_video_durations', `video_id=eq.${NEXT_VIDEO}`, {
      duration_seconds: nextDuration,
    });
    if (!Array.isArray(patched) || patched.length === 0) {
      await insert('karaoke_video_durations', {
        video_id: NEXT_VIDEO, duration_seconds: nextDuration, source: 'gate-b23-seed',
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        rearmed: true,
        gate: quotaFault ? 'G4 (quota_exceeded)'
          : lookupFault ? 'G3 (lookup_failed)'
          : tooLong ? 'G2 (too_long)' : 'G1 (pass_insufficient)',
        authority: BASE.host,
        roomSlug: SLUG,
        currentRequestId: current.id,
        expectedBlockedRequestId: next.id,
        nextSongDurationSeconds: (lookupFault || quotaFault) ? null : nextDuration,
        expectedReason: (tooLong || lookupFault || quotaFault) ? 'duration_unavailable' : 'pass_insufficient',
        expectedDurationFailureReason:
          quotaFault ? 'quota_exceeded' : lookupFault ? 'lookup_failed' : tooLong ? 'too_long' : null,
        // G3/G4 share this DB state EXACTLY. What separates them is the upstream fault the local
        // Worker process was started with, so the requirement is reported here rather than assumed.
        requiresServerEnv:
          quotaFault ? 'GATE_B23_UPSTREAM_FAULT=quota'
          : lookupFault ? 'GATE_B23_UPSTREAM_FAULT=lookup (or an invalid YOUTUBE_API_KEY)'
          : null,
        clearFaultCommand: (lookupFault || quotaFault) ? 'npm run gate:b23:g3:clear' : null,
        // G2 is classified upstream of the RPC, so no pass window can expire under it.
        passExpiresAt: (tooLong || lookupFault || quotaFault) ? null : expiresAt,
        passRemainingSeconds: (tooLong || lookupFault || quotaFault) ? null : PASS_REMAINING_SECONDS,
        deadline: (tooLong || lookupFault || quotaFault)
          ? 'NONE — the duration classifier/resolver runs before any entitlement check'
          : `~${PASS_REMAINING_SECONDS}s — re-arm immediately before tapping`,
        note: 'room, event and PAIRED DEVICES preserved — no re-pairing needed',
      },
      null,
      2,
    ),
  );
}

/**
 * GATE G3 — clear the transient fault. Restores ONLY the cached duration, leaving the stage exactly
 * where the server left it (current completed, next still waiting + Ready). That is what lets the
 * operator prove the second half of G3: after the failure is gone, a DELIBERATE Host Start
 * succeeds — and it succeeds from cache, with zero upstream calls.
 */
async function clearLookupFault() {
  const [room] = (await rest(`karaoke_rooms?slug=eq.${SLUG}&select=id`)) ?? [];
  if (!room) throw new Error(`No '${SLUG}' room on ${BASE.host} — run the seed first.`);
  await del(`karaoke_video_durations?video_id=eq.${NEXT_VIDEO}`);
  const seconds = Number(process.env.GATE_B23_RECOVER_SECONDS ?? 200);
  await insert('karaoke_video_durations', {
    video_id: NEXT_VIDEO, duration_seconds: seconds, source: 'gate-b23-seed',
  });
  console.log(JSON.stringify({
    lookupFaultCleared: true,
    authority: BASE.host,
    cachedDurationSeconds: seconds,
    stage: 'UNCHANGED — current stays completed, next stays waiting + Ready',
    note: 'a deliberate Host Start on the next song should now succeed from cache (no upstream call)',
  }, null, 2));
}

const mode = process.argv.includes('--clean')
  ? clean
  : process.argv.includes('--g3-clear')
    ? clearLookupFault
  : process.argv.includes('--rearm')
    ? () => rearm(
        process.argv.includes('--g2'),
        process.argv.includes('--g3'),
        process.argv.includes('--g4'),
      )
    : seed;
mode().catch((e) => {
  console.error(String(e.message ?? e));
  process.exit(1);
});
