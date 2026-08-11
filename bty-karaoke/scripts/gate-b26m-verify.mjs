#!/usr/bin/env node
// BUILD 26M — physical-gate evidence capture for Timed Pass continuation / switching.
//
// WHY THIS EXISTS: a switch gate passed from the phone screen proves only that the app drew a
// card. G4, G6, G7 and G8 are claims about SERVER state — that the switch did not start the new
// pass's clock, that the clock started at the song, that the window is exactly the product
// duration with no residual added, and that only one pass is ACTIVE. A screenshot cannot
// establish any of them. This reads the authority directly, before and after each step.
//
// STRICTLY READ-ONLY. It creates nothing, switches nothing, revokes nothing and starts nothing.
// The gate must travel the REAL native path or it proves nothing about the product. It also never
// prints an email, display name, room name or account id: an account is shown as an 8-char digest
// so two snapshots can be compared without putting identity into a terminal transcript.
//
//   node scripts/gate-b26m-verify.mjs --accounts            # which accounts can be gated, if any
//   node scripts/gate-b26m-verify.mjs --before <acctRef>    # G1 baseline  -> evidence/G1.json
//   node scripts/gate-b26m-verify.mjs --after-switch <acctRef>   # G4: armed, clock NOT started
//   node scripts/gate-b26m-verify.mjs --after-start <acctRef>    # G6/G7/G8: activation honesty
//
// Credentials come from .dev.vars (KARAOKE_SUPABASE_URL + service role), the same file the other
// scripts/ tools read.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

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
  if (!url || !key) throw new Error('.dev.vars is missing KARAOKE_SUPABASE_URL / SERVICE_ROLE_KEY');
  return { url, key };
}

const { url, key } = env();
const db = createClient(url, key, { auth: { persistSession: false } });

/** Stable non-reversible short reference, so snapshots compare without exposing identity. */
const ref = (id) => createHash('md5').update(String(id)).digest('hex').slice(0, 8);
const secs = (a, b) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 1000);

async function grantsFor(acctRef) {
  const { data, error } = await db
    .from('timed_access_pass_grants')
    .select('id,account_id,pass_type,duration_seconds,status,source_type,is_paid,apple_purchase_id,selected_at,activated_at,expires_at,expired_at,revoked_at,revoke_reason,created_at');
  if (error) throw error;
  const rows = data.filter((g) => ref(g.account_id) === acctRef);
  if (!rows.length) throw new Error(`no grants for account ref ${acctRef} — run --accounts first`);
  return rows;
}

function summarise(rows) {
  const now = Date.now();
  const view = (g) => ({
    pass: ref(g.id),
    type: g.pass_type,
    status: g.status,
    source: g.source_type,
    isPaid: g.is_paid,
    hasApplePurchase: g.apple_purchase_id != null,
    armed: g.selected_at != null,
    activatedAt: g.activated_at,
    expiresAt: g.expires_at,
    revokeReason: g.revoke_reason,
    windowSeconds: g.activated_at && g.expires_at ? secs(g.expires_at, g.activated_at) : null,
    remainingSeconds: g.status === 'ACTIVE' && g.expires_at
      ? Math.max(0, Math.round((new Date(g.expires_at).getTime() - now) / 1000)) : null,
  });
  return {
    counts: rows.reduce((a, g) => ((a[g.status] = (a[g.status] ?? 0) + 1), a), {}),
    activeValid: rows.filter((g) => g.status === 'ACTIVE' && new Date(g.expires_at) > now).length,
    selected: rows.filter((g) => g.status === 'SELECTED').length,
    grants: rows.map(view).sort((a, b) => a.status.localeCompare(b.status)),
  };
}

/** A check that states what it measured, so a FAIL is readable without re-deriving anything. */
function assert(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  return ok;
}

const [mode, acctRef] = process.argv.slice(2);

if (mode === '--accounts') {
  const { data, error } = await db
    .from('timed_access_pass_grants')
    .select('account_id,status,expires_at,pass_type');
  if (error) throw error;
  const now = Date.now();
  const by = new Map();
  for (const g of data) {
    const k = ref(g.account_id);
    const e = by.get(k) ?? { available: 0, activeValid: 0, activeStale: 0, selected: 0 };
    if (g.status === 'AVAILABLE') e.available++;
    else if (g.status === 'SELECTED') e.selected++;
    else if (g.status === 'ACTIVE') (new Date(g.expires_at) > now ? e.activeValid++ : e.activeStale++);
    by.set(k, e);
  }
  console.log('acctRef   AVAILABLE  ACTIVE(valid)  ACTIVE(stale)  SELECTED   gate-ready');
  for (const [k, e] of [...by].sort((a, b) => b[1].available - a[1].available)) {
    const ready = e.activeValid === 1 && e.available >= 1 && e.selected === 0;
    console.log(`${k}  ${String(e.available).padStart(9)}  ${String(e.activeValid).padStart(13)}  ${String(e.activeStale).padStart(13)}  ${String(e.selected).padStart(8)}   ${ready ? 'YES' : 'no'}`);
  }
  console.log('\nGate-ready = exactly one VALID ACTIVE pass + at least one AVAILABLE + nothing armed.');
} else if (mode === '--before') {
  const s = summarise(await grantsFor(acctRef));
  console.log('=== G1 BASELINE (capture BEFORE touching the device) ===');
  console.log(JSON.stringify(s, null, 2));
  console.log('\nG1 preconditions:');
  assert('exactly one VALID ACTIVE pass', s.activeValid === 1, `activeValid=${s.activeValid}`);
  assert('at least one AVAILABLE alternative', (s.counts.AVAILABLE ?? 0) >= 1, `available=${s.counts.AVAILABLE ?? 0}`);
  assert('nothing already armed', s.selected === 0, `selected=${s.selected}`);
  // Only a VALID pass may produce this hint. A stale ACTIVE row reports 0s remaining, and
  // printing that as though it were a fixture would send someone into a gate run they cannot
  // pass — the precondition above already says activeValid=0, and the hint must not contradict it.
  const act = s.grants.find((g) => g.status === 'ACTIVE' && (g.remainingSeconds ?? 0) > 0);
  if (act) {
    console.log(`\n  ACTIVE pass ${act.pass}: ${act.remainingSeconds}s remaining — queue a song LONGER than this (max 900s).`);
    if (act.remainingSeconds >= 900) {
      console.log(`  NOT YET GATEABLE: begin_song_v2 refuses any duration > 900s, so no legal song can exceed`);
      console.log(`  ${act.remainingSeconds}s of remaining time. Wait ${act.remainingSeconds - 900}s more, then re-check.`);
    }
  } else {
    console.log('\n  No VALID ACTIVE pass — there is nothing to gate yet. Arm the fixture first.');
  }
} else if (mode === '--after-switch') {
  const s = summarise(await grantsFor(acctRef));
  console.log('=== G4 — IMMEDIATELY AFTER the confirmed switch, BEFORE starting a song ===');
  console.log(JSON.stringify(s, null, 2));
  const revoked = s.grants.filter((g) => g.status === 'REVOKED' && g.revokeReason === 'switched_pass');
  const armed = s.grants.filter((g) => g.status === 'SELECTED');
  console.log('\nG4 assertions:');
  assert('0 ACTIVE passes', s.activeValid === 0 && (s.counts.ACTIVE ?? 0) === 0, `ACTIVE=${s.counts.ACTIVE ?? 0}`);
  assert('exactly 1 SELECTED pass', armed.length === 1, `SELECTED=${armed.length}`);
  assert("old pass REVOKED with revoke_reason='switched_pass'", revoked.length >= 1, `switched=${revoked.length}`);
  assert('old pass RETAINED its activation facts (history not rewritten)',
    revoked.every((g) => g.activatedAt != null && g.expiresAt != null));
  // THE POINT OF G4: arming must not have started a clock.
  assert('armed pass has activated_at = null', armed.every((g) => g.activatedAt == null));
  assert('armed pass has expires_at = null', armed.every((g) => g.expiresAt == null));
} else if (mode === '--after-start') {
  const s = summarise(await grantsFor(acctRef));
  console.log('=== G6 / G7 / G8 — AFTER the previously blocked song started ===');
  console.log(JSON.stringify(s, null, 2));
  const act = s.grants.filter((g) => g.status === 'ACTIVE');
  console.log('\nG6/G7/G8 assertions:');
  assert('exactly ONE ACTIVE pass (G8)', act.length === 1, `ACTIVE=${act.length}`);
  if (act.length === 1) {
    const a = act[0];
    const expected = { ONE_HOUR: 3600, FOUR_HOURS: 14400, TWENTY_FOUR_HOURS: 86400 }[a.type];
    // G7: the forfeited residual must NOT have been added to the new pass.
    assert(`window is EXACTLY the product duration, no residual added (G7)`,
      a.windowSeconds === expected, `window=${a.windowSeconds}s expected=${expected}s`);
    assert('activated_at is set (clock started at the song, not the switch) (G6)', a.activatedAt != null);
    console.log(`\n  activated_at = ${a.activatedAt}`);
    console.log('  Compare this against the wall-clock instant you tapped start — NOT the switch instant.');
  }
  assert('no pass is left armed', s.selected === 0, `SELECTED=${s.selected}`);
} else {
  console.log('usage: --accounts | --before <acctRef> | --after-switch <acctRef> | --after-start <acctRef>');
  process.exit(1);
}
