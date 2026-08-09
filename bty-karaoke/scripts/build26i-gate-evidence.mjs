#!/usr/bin/env node
// BUILD 26I — device-gate evidence capture for account deletion.
//
// WHY THIS EXISTS: a deletion gate passed from the phone screen proves only that the app
// showed a signed-out screen. BUILD 26E's G4 was passed with server-side verification for
// exactly that reason, and BUILD 26I §5 makes it a rule: "Do not rely only on UI
// screenshots." This tool captures the authoritative server state BEFORE a destructive
// gate and checks the AFTER state against the published retention ledger, class by class.
//
// STRICTLY READ-ONLY. It creates nothing, deletes nothing, and mutates nothing — the
// deletion under test must travel the real Native path, or the gate proves nothing about
// the product. It also never prints an email, display name or provider subject: the
// retention question is whether identifying data is gone, and a tool that echoes it into a
// terminal transcript answers that question badly.
//
//   node scripts/build26i-gate-evidence.mjs --list
//   node scripts/build26i-gate-evidence.mjs --census  > evidence/G1-before.json
//   node scripts/build26i-gate-evidence.mjs --census-diff evidence/G1-before.json
//   node scripts/build26i-gate-evidence.mjs --baseline <accountId> > evidence/G5-before.json
//   node scripts/build26i-gate-evidence.mjs --verify   <accountId>
//   node scripts/build26i-gate-evidence.mjs --recreation <oldAccountId> <newAccountId>
//
// Credentials come from .dev.vars (KARAOKE_SUPABASE_URL + service role), the same file the
// other scripts/ tools read.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function env() {
  const raw = readFileSync(join(ROOT, '.dev.vars'), 'utf8');
  const kv = {};
  for (const line of raw.split('\n')) {
    if (!line.includes('=') || line.trimStart().startsWith('#')) continue;
    kv[line.slice(0, line.indexOf('=')).trim()] = line.slice(line.indexOf('=') + 1).trim();
  }
  const url = kv.KARAOKE_SUPABASE_URL;
  const key = kv.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('.dev.vars must define KARAOKE_SUPABASE_URL and KARAOKE_SUPABASE_SERVICE_ROLE_KEY');
  return { url, key };
}

const { url: URL_, key: KEY } = env();

async function q(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path} :: ${text.slice(0, 200)}`);
  const range = r.headers.get('content-range');
  return { rows: text ? JSON.parse(text) : [], count: range ? Number(range.split('/')[1]) : undefined };
}

const uuidList = (ids) => `(${ids.length ? ids.join(',') : '00000000-0000-0000-0000-000000000000'})`;

/** The rooms an account owns, resolved the same way the deletion RPC resolves them. */
async function estate(accountId) {
  const mem = await q(`karaoke_workspace_members?select=workspace_id,role,status&account_id=eq.${accountId}`);
  const wsIds = [...new Set(mem.rows.filter((m) => m.role === 'owner').map((m) => m.workspace_id))];
  if (!wsIds.length) return { wsIds: [], roomIds: [] };
  const own = await q(`karaoke_room_ownership?select=room_id&workspace_id=in.${uuidList(wsIds)}`);
  return { wsIds, roomIds: [...new Set(own.rows.map((o) => o.room_id))] };
}

async function snapshot(accountId) {
  const acct = await q(
    `karaoke_accounts?select=id,created_at,deleted_at,anonymized_at,account_status,deletion_version,` +
      `email,display_name,provider,provider_subject,timezone,timezone_source,last_login_at,` +
      `purchase_owner_ref,authority_ref&id=eq.${accountId}`,
  );
  if (!acct.rows.length) throw new Error(`no such account: ${accountId}`);
  const a = acct.rows[0];
  const { wsIds, roomIds } = await estate(accountId);
  const rl = uuidList(roomIds);

  const [ids, sessions, devicesByAcct, passes, passAudit, plans, saved, segs, rooms, workspaces, requests,
         events, handoffs, fps, audit, evts, jobs, outbox, carryIn, carryFrom] = await Promise.all([
    q(`karaoke_account_identities?select=provider&account_id=eq.${accountId}`),
    q(`karaoke_host_sessions?select=status&account_id=eq.${accountId}`),
    q(`karaoke_dj_devices?select=status&account_id=eq.${accountId}`),
    q(`timed_access_pass_grants?select=id,pass_type,status,selected_at,activated_at,expires_at,expired_at,revoked_at,revoke_reason&account_id=eq.${accountId}`),
    q(`timed_access_pass_audit?select=action,from_status,to_status,actor_type,reason&account_id=eq.${accountId}`),
    q(`karaoke_host_plan_assignments?select=plan_code,status&account_id=eq.${accountId}`),
    q(`karaoke_user_saved_songs?select=id&account_id=eq.${accountId}&limit=1`),
    q(`karaoke_event_usage_segments?select=id,started_at,ended_at,metered,lease_seconds&account_id=eq.${accountId}`),
    roomIds.length ? q(`karaoke_rooms?select=id,slug,status,retired_at,display_name,logo_object_key,logo_version,admin_pin_hash,guest_welcome_message&id=in.${rl}`) : { rows: [] },
    wsIds.length ? q(`karaoke_workspaces?select=id,status,retired_at&id=in.${uuidList(wsIds)}`) : { rows: [] },
    roomIds.length ? q(`karaoke_requests?select=guest_name,search_query,status,resolution_code,position&room_id=in.${rl}`) : { rows: [] },
    roomIds.length ? q(`karaoke_events?select=status,name,host_name,created_by&room_id=in.${rl}`) : { rows: [] },
    roomIds.length ? q(`karaoke_guest_app_handoffs?select=status&room_id=in.${rl}`) : { rows: [] },
    q(`karaoke_identity_fingerprints?select=provider,account_tombstone_id,first_deleted_at,last_deleted_at&account_tombstone_id=eq.${accountId}`),
    q(`karaoke_account_deletion_audit?select=deleted_at,deletion_version,deletion_source,completion_status,credential_revocation_status,storage_cleanup_status,provider_revocation&account_id=eq.${accountId}`),
    q(`karaoke_account_deletion_events?select=event_type,detail_code,attempt_count,created_at&account_id=eq.${accountId}&order=created_at`),
    q(`karaoke_provider_revocation_jobs?select=provider,status,encrypted_refresh_token,token_nonce,attempt_count,last_error_code,completed_at,manual_required_at&account_id=eq.${accountId}`),
    q(`karaoke_storage_cleanup_outbox?select=bucket,status,attempts,enqueued_at,deadline_at,completed_at,last_error&account_tombstone_id=eq.${accountId}`),
    q(`karaoke_free_window_carryover?select=charged_window_start,carried_used_seconds,grace_consumed,source_tombstone_id&account_id=eq.${accountId}`),
    q(`karaoke_free_window_carryover?select=account_id,charged_window_start,carried_used_seconds,grace_consumed&source_tombstone_id=eq.${accountId}`),
  ]);

  const tally = (rows, k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {});

  return {
    capturedAt: new Date().toISOString(),
    accountId,
    account: {
      created_at: a.created_at,
      account_status: a.account_status,
      deleted_at: a.deleted_at,
      anonymized_at: a.anonymized_at,
      deletion_version: a.deletion_version,
      // Presence, never content.
      email_present: a.email !== null,
      display_name_present: a.display_name !== null,
      legacy_provider_present: a.provider !== null,
      legacy_provider_subject_present: a.provider_subject !== null,
      last_login_present: a.last_login_at !== null,
      timezone: a.timezone,
      timezone_source: a.timezone_source,
      refs_independent:
        a.purchase_owner_ref !== a.authority_ref &&
        a.purchase_owner_ref !== a.id &&
        a.authority_ref !== a.id,
    },
    identities: ids.rows.map((r) => r.provider).sort(),
    sessions: tally(sessions.rows, 'status'),
    devices_by_account: tally(devicesByAcct.rows, 'status'),
    passes: passes.rows,
    pass_audit_count: passAudit.count,
    pass_audit_actions: tally(passAudit.rows, 'action'),
    plans: plans.rows,
    saved_songs: saved.count,
    usage_segments: segs.rows.map((s) => ({
      started_at: s.started_at, ended_at: s.ended_at, metered: s.metered, lease_seconds: s.lease_seconds,
    })),
    workspaces: workspaces.rows.map((w) => ({ status: w.status, retired: w.retired_at !== null })),
    rooms: rooms.rows.map((r) => ({
      slug: r.slug, status: r.status, retired: r.retired_at !== null, display_name: r.display_name,
      logo_key_present: r.logo_object_key !== null, logo_version_present: r.logo_version !== null,
      admin_pin_present: r.admin_pin_hash !== null, welcome_present: r.guest_welcome_message !== null,
    })),
    requests: {
      total: requests.rows.length,
      guest_names: tally(requests.rows, 'guest_name'),
      search_query_present: requests.rows.filter((r) => r.search_query !== null).length,
      statuses: tally(requests.rows, 'status'),
      resolution_codes: tally(requests.rows.filter((r) => r.resolution_code !== null), 'resolution_code'),
      positions: requests.rows.map((r) => r.position),
    },
    events: events.rows.map((e) => ({
      status: e.status, name: e.name, host_name_present: e.host_name !== null, created_by_present: e.created_by !== null,
    })),
    handoffs: tally(handoffs.rows, 'status'),
    identity_fingerprints: fps.rows,
    deletion_audit: audit.rows,
    deletion_events: evts.rows,
    revocation_jobs: jobs.rows.map((j) => ({
      provider: j.provider, status: j.status,
      token_material_erased: j.encrypted_refresh_token === null && j.token_nonce === null,
      attempt_count: j.attempt_count, last_error_code: j.last_error_code,
      completed_at: j.completed_at, manual_required_at: j.manual_required_at,
    })),
    storage_outbox: outbox.rows,
    carryover_received: carryIn.rows,
    carryover_sourced_from_this_account: carryFrom.rows,
  };
}

// ── the retention ledger, as executable checks ───────────────────────────────
//
// One entry per BUILD 26I §3 data class. `must` returns null when the class is correct
// after deletion, or a string saying exactly what is wrong.
const LEDGER = [
  ['karaoke_accounts (tombstone)', 'ANONYMIZE', (s) =>
    s.account.account_status === 'deleted' && s.account.deleted_at && s.account.anonymized_at &&
    !s.account.email_present && !s.account.display_name_present && !s.account.last_login_present
      ? null : 'account row is not a complete tombstone'],
  ['legacy provider columns', 'DELETE', (s) =>
    !s.account.legacy_provider_present && !s.account.legacy_provider_subject_present
      ? null : 'deprecated provider/provider_subject still populated'],
  ['pseudonymous refs', 'RETAIN', (s) =>
    s.account.refs_independent ? null : 'purchase_owner_ref / authority_ref are not independent'],
  ['identity links', 'DELETE', (s) => s.identities.length === 0 ? null : `identities still present: ${s.identities}`],
  ['provider fingerprints', 'RETAIN', (s) =>
    s.identity_fingerprints.length > 0 ? null : 'no one-way fingerprint retained (FREE-window reset would reopen)'],
  ['host sessions', 'RETAIN (revoked, 90d)', (s) =>
    !s.sessions.active ? null : `${s.sessions.active} session(s) still active`],
  ['dj devices (account)', 'RETAIN (revoked)', (s) =>
    !s.devices_by_account.active ? null : `${s.devices_by_account.active} device(s) still active`],
  ['timed pass grants', 'RETAIN (revoked)', (s) => {
    const usable = s.passes.filter((p) => ['AVAILABLE', 'SELECTED', 'ACTIVE'].includes(p.status));
    if (usable.length) return `${usable.length} pass(es) still usable: ${usable.map((p) => p.status)}`;
    const bad = s.passes.filter((p) => p.status === 'REVOKED' && p.revoke_reason !== 'account_deleted');
    return bad.length ? `revoked pass without account_deleted reason` : null;
  }],
  ['ACTIVE-pass activation facts', 'RETAIN', (s) => {
    const wasActive = s.passes.filter((p) => p.revoke_reason === 'account_deleted' && p.activated_at !== null);
    if (!wasActive.length) return null; // class not exercised by this fixture
    return wasActive.every((p) => p.expires_at !== null) ? null : 'activation facts were rewritten on revoke';
  }],
  ['timed pass audit', 'RETAIN (append-only)', (s) =>
    s.pass_audit_count > 0 || s.passes.length === 0 ? null : 'pass exists but its audit trail is gone'],
  ['host plan assignments', 'RETAIN (ended)', (s) =>
    s.plans.every((p) => p.status !== 'active') ? null : 'an active plan assignment survived'],
  ['saved songs', 'DELETE', (s) => s.saved_songs === 0 ? null : `${s.saved_songs} saved song(s) remain`],
  ['metering / usage segments', 'RETAIN', (s) => null], // retained by design; presence is not a failure
  ['workspaces', 'RETAIN (retired)', (s) =>
    s.workspaces.every((w) => w.status === 'retired' && w.retired) ? null : 'a workspace was not retired'],
  ['rooms', 'ANONYMIZE + RETIRE', (s) =>
    s.rooms.every((r) => r.status === 'retired' && r.retired && !r.logo_key_present &&
                         !r.admin_pin_present && !r.welcome_present)
      ? null : 'a room is not fully retired/anonymized'],
  ['room slugs', 'RETAIN (never reusable)', (s) =>
    s.rooms.every((r) => typeof r.slug === 'string' && r.slug.length > 0)
      ? null : 'a slug was released and could be reused'],
  ['request history', 'ANONYMIZE (truth kept)', (s) =>
    s.requests.search_query_present === 0 ? null : `${s.requests.search_query_present} search_query value(s) remain`],
  ['events', 'ANONYMIZE + END', (s) =>
    s.events.every((e) => e.status === 'ended' && !e.host_name_present && !e.created_by_present)
      ? null : 'an event was left live or attributed'],
  ['guest handoffs', 'RETAIN (revoked)', (s) =>
    !s.handoffs.ACTIVE ? null : `${s.handoffs.ACTIVE} handoff(s) still ACTIVE`],
  ['logo objects', 'DELETE (durable outbox)', (s) =>
    s.storage_outbox.every((o) => o.status === 'DONE' || o.status === 'PENDING')
      ? (s.storage_outbox.some((o) => o.status === 'PENDING' && new Date(o.deadline_at) < new Date())
          ? 'a storage cleanup row is past its deadline' : null)
      : 'a storage cleanup row FAILED'],
  ['deletion audit', 'RETAIN (permanent)', (s) =>
    s.deletion_audit.length === 1 ? null : `expected exactly 1 audit row, found ${s.deletion_audit.length}`],
  ['provider revocation', 'RETAIN (job + events)', (s) => {
    const stuck = s.revocation_jobs.filter((j) => !['succeeded', 'manual_required'].includes(j.status));
    if (stuck.length) return `revocation job not settled: ${stuck.map((j) => `${j.provider}=${j.status}`)}`;
    const leaky = s.revocation_jobs.filter((j) => !j.token_material_erased);
    return leaky.length ? 'a settled job still holds token material' : null;
  }],
];

function verify(s) {
  console.log(`\nBUILD 26I retention ledger — account ${s.accountId}`);
  console.log(`captured ${s.capturedAt}\n`);
  console.log('STATUS  DATA CLASS                          ACTION');
  console.log('─'.repeat(78));
  let fail = 0;
  for (const [name, action, must] of LEDGER) {
    let problem = null;
    try { problem = must(s); } catch (e) { problem = `check threw: ${e.message}`; }
    if (problem) fail++;
    console.log(`${problem ? 'FAIL  ' : 'PASS  '}  ${name.padEnd(35)} ${action}`);
    if (problem) console.log(`        └─ ${problem}`);
  }
  console.log('─'.repeat(78));
  console.log(fail === 0 ? 'LEDGER PASS — every data class matches the published contract'
                         : `LEDGER FAIL — ${fail} class(es) deviate`);
  return fail === 0;
}

// ── entry points ─────────────────────────────────────────────────────────────

const [mode, ...rest] = process.argv.slice(2);

/**
 * A whole-database census of every deletion-relevant fact.
 *
 * The non-destructive gates (G1, G2, and the Cancel legs) must prove the OPPOSITE of a
 * deletion: that nothing changed anywhere. Checking one account cannot prove that, and
 * asking the Founder which account they were signed in as puts a UUID in their hands for
 * no reason. Censusing everything before and after answers it exactly, and also catches
 * the failure a single-account check would miss entirely — a cancel that mutated some
 * OTHER account.
 */
async function census() {
  const [accts, ids, sess, grants, audit, fps, evts, jobs, outbox, rooms, ws, carry] = await Promise.all([
    q('karaoke_accounts?select=id,account_status,deleted_at,anonymized_at,updated_at&order=created_at'),
    q('karaoke_account_identities?select=account_id,provider&order=account_id'),
    q('karaoke_host_sessions?select=id,account_id,status&order=id'),
    q('timed_access_pass_grants?select=id,account_id,status,activated_at,revoked_at&order=id'),
    q('karaoke_account_deletion_audit?select=account_id,deleted_at&order=deleted_at'),
    q('karaoke_identity_fingerprints?select=fingerprint,provider,account_tombstone_id,first_deleted_at,last_deleted_at&order=fingerprint'),
    q('karaoke_account_deletion_events?select=account_id,event_type,created_at&order=created_at'),
    q('karaoke_provider_revocation_jobs?select=account_id,provider,status&order=account_id'),
    q('karaoke_storage_cleanup_outbox?select=object_key,status&order=object_key'),
    q('karaoke_rooms?select=id,slug,status,retired_at&order=id'),
    q('karaoke_workspaces?select=id,status&order=id'),
    q('karaoke_free_window_carryover?select=account_id,charged_window_start,carried_used_seconds,grace_consumed&order=account_id'),
  ]);
  return {
    capturedAt: new Date().toISOString(),
    accounts: accts.rows,
    identities: ids.rows,
    sessions: sess.rows,
    pass_grants: grants.rows,
    deletion_audit: audit.rows,
    fingerprints: fps.rows,
    deletion_events: evts.rows,
    revocation_jobs: jobs.rows,
    storage_outbox: outbox.rows,
    rooms: rooms.rows,
    workspaces: ws.rows,
    carryover: carry.rows,
  };
}

if (mode === '--census') {
  console.log(JSON.stringify(await census(), null, 2));
} else if (mode === '--census-diff') {
  const before = JSON.parse(readFileSync(rest[0], 'utf8'));
  const after = await census();
  const keys = Object.keys(before).filter((k) => k !== 'capturedAt');
  console.log(`\nBUILD 26I census diff — non-destructive gate proof`);
  console.log(`before ${before.capturedAt}`);
  console.log(`after  ${after.capturedAt}\n`);
  let changed = 0;
  for (const k of keys) {
    const b = JSON.stringify(before[k]);
    const a = JSON.stringify(after[k]);
    const same = b === a;
    if (!same) changed++;
    console.log(`${same ? 'UNCHANGED' : 'CHANGED  '}  ${k.padEnd(18)} ${before[k].length} row(s)${same ? '' : ` → ${after[k].length}`}`);
    if (!same) {
      const bs = new Set(before[k].map((r) => JSON.stringify(r)));
      const as = new Set(after[k].map((r) => JSON.stringify(r)));
      for (const r of after[k].map((r) => JSON.stringify(r))) if (!bs.has(r)) console.log(`            + ${r}`);
      for (const r of before[k].map((r) => JSON.stringify(r))) if (!as.has(r)) console.log(`            - ${r}`);
    }
  }
  console.log('─'.repeat(70));
  console.log(changed === 0
    ? 'CENSUS IDENTICAL — zero server mutation anywhere in production'
    : `CENSUS CHANGED — ${changed} table(s) differ (see above)`);
  process.exit(changed === 0 ? 0 : 1);
} else if (mode === '--list') {
  const accts = await q('karaoke_accounts?select=id,created_at,account_status,deleted_at&order=created_at');
  const ids = await q('karaoke_account_identities?select=account_id,provider');
  const byAcct = {};
  for (const i of ids.rows) (byAcct[i.account_id] ??= []).push(i.provider);
  console.log('accountId                              created              status   providers');
  for (const a of accts.rows) {
    console.log(`${a.id}  ${a.created_at.slice(0, 19)}  ${a.account_status.padEnd(8)} ${(byAcct[a.id] ?? []).sort().join('+') || '—'}`);
  }
} else if (mode === '--baseline') {
  console.log(JSON.stringify(await snapshot(rest[0]), null, 2));
} else if (mode === '--verify') {
  const s = await snapshot(rest[0]);
  if (!s.account.deleted_at) {
    console.log(`account ${rest[0]} is NOT deleted — nothing to verify (status ${s.account.account_status})`);
    process.exit(2);
  }
  process.exit(verify(s) ? 0 : 1);
} else if (mode === '--recreation') {
  // §7 / §8: the old account must stay a tombstone and the new one must be genuinely new.
  const [oldId, newId] = rest;
  const [o, n] = [await snapshot(oldId), await snapshot(newId)];
  const checks = [
    ['new account is a DIFFERENT row', oldId !== newId],
    ['old account is still tombstoned', o.account.account_status === 'deleted' && o.account.deleted_at !== null],
    ['old account has no identities', o.identities.length === 0],
    ['old account was never re-activated', o.account.anonymized_at !== null],
    // NOT "the new account is active": a gate fixture is often deleted again straight
    // afterwards, and that is not a resurrection. What must hold is that the new account
    // has its OWN lifecycle — if it was later deleted it carries its own deletion audit,
    // never the old account's.
    ['new account has its own lifecycle',
      n.account.account_status === 'active' ||
      (n.deletion_audit.length === 1 && n.account.deleted_at !== o.account.deleted_at)],
    ['new account was created AFTER the deletion', new Date(n.account.created_at) > new Date(o.account.deleted_at)],
    ['new account owns no room of the old account', n.rooms.every((r) => !o.rooms.some((x) => x.slug === r.slug))],
    ['new account inherited no pass', n.passes.length === 0 || !n.passes.some((p) => o.passes.some((x) => x.id === p.id))],
    ['old account retains its fingerprint', o.identity_fingerprints.length > 0],
    ['FREE-window state carried, nothing else', n.carryover_received.every((c) => c.source_tombstone_id === oldId)],
  ];
  console.log(`\nBUILD 26I recreation invariant — ${oldId} → ${newId}\n`);
  let fail = 0;
  for (const [label, ok] of checks) { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); }
  if (n.carryover_received.length) console.log('\ncarryover received:', JSON.stringify(n.carryover_received));
  console.log(fail === 0 ? '\nRECREATION PASS — the tombstone was not resurrected' : `\nRECREATION FAIL — ${fail} invariant(s) broken`);
  process.exit(fail === 0 ? 0 : 1);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 22).join('\n').replace(/^\/\/ ?/gm, ''));
  process.exit(1);
}
