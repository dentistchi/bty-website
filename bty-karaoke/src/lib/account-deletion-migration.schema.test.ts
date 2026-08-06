// BUILD 26E — migration schema pins. These assert the SQL actually implements the
// retention decisions, because every one of them is a rule that only exists in the
// migration: if the SQL drifts, nothing else in the codebase would notice.
//
// Deliberately assertions about SQL TEXT, not behaviour — the behavioural coverage lives
// in the service/route tests. What is pinned here is the set of properties that cannot be
// observed from TypeScript at all: cascade choices, CHECK shapes, and trigger scope.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'supabase/migrations/20260809120000_karaoke_account_deletion_authority_v1.sql';
const raw = readFileSync(join(process.cwd(), FILE), 'utf8');

/**
 * Strip full-line SQL comments before asserting.
 *
 * Mutation testing caught this: commenting OUT the identity delete left the text intact,
 * so `toMatch(/delete from .../)` still passed and the mutant survived. Prose describing a
 * rule must never be able to satisfy an assertion about the rule.
 */
const stripComments = (t: string) =>
  t
    .split('\n')
    .map((l) => (l.trimStart().startsWith('--') ? '' : l))
    .join('\n');

const sql = stripComments(raw);

/** The prior migration whose two function bodies this one re-issues. */
const priorSql = stripComments(
  readFileSync(
    join(process.cwd(), 'supabase/migrations/20260807120000_karaoke_free_window_truth_v1.sql'),
    'utf8',
  ),
);

describe(`${FILE} — tombstone`, () => {
  it('adds the tombstone fields the Founder decision names', () => {
    for (const col of [
      'deleted_at',
      'anonymized_at',
      'deletion_version',
      'account_status',
      'purchase_owner_ref',
      'authority_ref',
    ]) {
      expect(sql).toMatch(new RegExp(`add column if not exists ${col}\\b`));
    }
  });

  it('generates purchase_owner_ref and authority_ref INDEPENDENTLY of account_id', () => {
    // Both must be random, not derived — a derived ref would be reversible to the account.
    expect(sql).toMatch(/purchase_owner_ref uuid not null default gen_random_uuid\(\)/);
    expect(sql).toMatch(/authority_ref\s+uuid not null default gen_random_uuid\(\)/);
    expect(sql).not.toMatch(/purchase_owner_ref[^\n]*=[^\n]*account_id/);
  });

  it('keeps account_status and deleted_at from disagreeing', () => {
    expect(sql).toMatch(
      /karaoke_accounts_deleted_coherent_chk[\s\S]*?check \(\(account_status = 'deleted'\) = \(deleted_at is not null\)\)/,
    );
  });

  it('NEVER hard-deletes karaoke_accounts anywhere in the migration', () => {
    // The central invariant. A delete of the account row would fire 19 FKs.
    expect(sql).not.toMatch(/delete\s+from\s+public\.karaoke_accounts/i);
  });
});

describe(`${FILE} — F-5 one-way fingerprint`, () => {
  it('retains fingerprints with RESTRICT so a tombstone cannot be removed under them', () => {
    expect(sql).toMatch(/create table if not exists public\.karaoke_identity_fingerprints/);
    expect(sql).toMatch(
      /account_tombstone_id uuid not null references public\.karaoke_accounts\(id\) on delete restrict/,
    );
  });

  it('stores no provider subject or email alongside the fingerprint', () => {
    const block = sql.slice(
      sql.indexOf('create table if not exists public.karaoke_identity_fingerprints'),
      sql.indexOf('karaoke_identity_fingerprints_tombstone_idx'),
    );
    expect(block).not.toMatch(/provider_subject/);
    expect(block).not.toMatch(/email/);
  });

  it('deletes the identity rows so the provider can no longer resolve the account', () => {
    expect(sql).toMatch(/delete from public\.karaoke_account_identities where account_id = p_account_id/);
  });

  it('FAILS CLOSED when a fingerprint is missing for an identity it would delete', () => {
    expect(sql).toMatch(/fingerprint_incomplete/);
    // The check must run BEFORE any mutation.
    expect(sql.indexOf('fingerprint_incomplete')).toBeLessThan(
      sql.indexOf('update public.karaoke_host_sessions'),
    );
  });

  it('nulls the DEPRECATED provider columns on the account row too', () => {
    // A "delete the identity rows" that forgets these leaves a second copy of the subject.
    expect(sql).toMatch(/set email = null,[\s\S]*?provider = null,[\s\S]*?provider_subject = null/);
  });
});

describe(`${FILE} — F-1 room freeze`, () => {
  it("adds 'retired' additively, leaving open/closed valid", () => {
    expect(sql).toMatch(/check \(status in \('open', 'closed', 'retired'\)\)/);
  });

  it('retires rather than deleting rooms, workspaces or their history', () => {
    expect(sql).toMatch(/update public\.karaoke_rooms\s*\n\s*set status = 'retired'/);
    expect(sql).toMatch(/update public\.karaoke_workspaces\s*\n\s*set status = 'retired'/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.karaoke_rooms/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.karaoke_events/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.karaoke_requests/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.karaoke_workspaces/i);
  });

  it('anonymizes room presentation and clears the logo pointer in-transaction', () => {
    expect(sql).toMatch(/display_name = v_deleted_lbl/);
    expect(sql).toMatch(/guest_welcome_message = null/);
    expect(sql).toMatch(/logo_object_key = null/);
    expect(sql).toMatch(/admin_pin_hash = null/);
  });

  it('RETAINS the slug so it can never be reused by a future room', () => {
    // Any rewrite of slug would release a globally-unique identifier an old QR still points at.
    expect(sql).not.toMatch(/set[\s\S]{0,200}\bslug\s*=/);
  });

  it('answers room_retired explicitly instead of ownership_state_invalid', () => {
    expect(sql).toMatch(/'outcome','room_retired'/);
    // The guard must precede owner resolution, or the ownership branch wins first.
    expect(sql.indexOf("'outcome','room_retired'")).toBeLessThan(
      sql.indexOf('v_account := public.karaoke_room_owner_account(p_room_id)'),
    );
  });
});

describe(`${FILE} — F-3 credential revocation`, () => {
  it('gives every credential class an explicit terminal state', () => {
    expect(sql).toMatch(/update public\.karaoke_host_sessions\s*\n\s*set status = 'revoked'/);
    expect(sql).toMatch(/update public\.karaoke_dj_devices\s*\n\s*set status = 'revoked'/);
    expect(sql).toMatch(/update public\.karaoke_pairing_tokens\s*\n\s*set expires_at = v_now/);
    expect(sql).toMatch(/update public\.karaoke_admin_setup_tokens\s*\n\s*set expires_at = v_now/);
    expect(sql).toMatch(/update public\.karaoke_guest_app_handoffs\s*\n\s*set status = 'REVOKED'/);
    expect(sql).toMatch(/update public\.karaoke_sessions\s*\n\s*set status = 'ended'/);
  });

  it('revokes devices bound to the ACCOUNT and devices bound to any frozen room', () => {
    expect(sql).toMatch(/account_id = p_account_id or room_id = any\(v_room_ids\)/);
  });

  it('never merely nulls a device account_id as a substitute for revoking', () => {
    expect(sql).not.toMatch(/karaoke_dj_devices[\s\S]{0,200}set account_id = null/);
  });
});

describe(`${FILE} — F-4 history retention`, () => {
  it('anonymizes guest names but leaves resolution truth untouched', () => {
    expect(sql).toMatch(/set guest_name = v_guest_lbl,\s*\n\s*search_query = null/);
    const stmt = sql.slice(
      sql.indexOf('update public.karaoke_requests'),
      sql.indexOf('select count(*) into v_requests'),
    );
    for (const forbidden of ['resolution_code', 'resolved_at', 'position', 'completed_at', 'status =']) {
      expect(stmt).not.toMatch(new RegExp(forbidden));
    }
  });

  it('retains playback, lease and metering rows entirely', () => {
    expect(sql).not.toMatch(/delete\s+from\s+public\.karaoke_event_usage_segments/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.karaoke_free_final_song_grace/i);
  });

  it('retains pass grants and the append-only pass audit', () => {
    expect(sql).not.toMatch(/delete\s+from\s+public\.timed_access_pass_grants/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.timed_access_pass_audit/i);
  });
});

describe(`${FILE} — §10 entitlement revocation`, () => {
  it('revokes AVAILABLE, SELECTED and ACTIVE passes and audits each', () => {
    expect(sql).toMatch(/status in \('AVAILABLE', 'SELECTED', 'ACTIVE'\)/);
    expect(sql).toMatch(/insert into public\.timed_access_pass_audit[\s\S]*?'REVOKED'/);
  });

  it('relaxes the status/time CHECK so refund-after-use is representable', () => {
    // The deployed constraint forbids REVOKED from ACTIVE, which made "revoke every
    // active pass" unrepresentable. The never-activated branch must survive unchanged.
    expect(sql).toMatch(
      /when 'REVOKED'\s+then revoked_at is not null and \([\s\S]*?activated_at is null and expires_at is null and expired_at is null[\s\S]*?or \(activated_at is not null and expires_at is not null\)/,
    );
  });
});

describe(`${FILE} — F-2 storage outbox`, () => {
  it('enqueues logo objects durably with a deadline, one row per object', () => {
    expect(sql).toMatch(/create table if not exists public\.karaoke_storage_cleanup_outbox/);
    expect(sql).toMatch(/karaoke_storage_cleanup_outbox_object_idx[\s\S]*?\(bucket, object_key\)/);
    expect(sql).toMatch(/deadline_at\s+timestamptz not null/);
    expect(sql).toMatch(/v_now \+ interval '30 days'/);
  });
});

describe(`${FILE} — F-6 audit and purge`, () => {
  it('makes the deletion audit append-only', () => {
    expect(sql).toMatch(
      /before update or delete on public\.karaoke_account_deletion_audit[\s\S]*?for each row/,
    );
  });

  it('stores no PII in the deletion audit', () => {
    const block = sql.slice(
      sql.indexOf('create table if not exists public.karaoke_account_deletion_audit'),
      sql.indexOf('karaoke_account_deletion_audit_account_idx'),
    );
    for (const forbidden of ['email', 'display_name', 'provider_subject', 'token_hash']) {
      expect(block).not.toMatch(new RegExp(forbidden));
    }
  });

  it('purges deleted-account sessions after 90 days without touching the audit', () => {
    expect(sql).toMatch(/deleted_at < now\(\) - interval '90 days'/);
    expect(sql).not.toMatch(/delete from public\.karaoke_account_deletion_audit/i);
  });
});

describe(`${FILE} — F-7 attribution`, () => {
  it('adds and backfills the pseudonymous actor snapshots', () => {
    expect(sql).toMatch(/add column if not exists created_by_ref uuid/);
    expect(sql).toMatch(/add column if not exists claimed_by_ref uuid/);
    expect(sql).toMatch(/add column if not exists assigned_by_ref uuid/);
    expect(sql).toMatch(/update public\.karaoke_workspaces w set created_by_ref = a\.authority_ref/);
  });

  it('snapshots the pseudonymous ref, never a name or email', () => {
    expect(sql).not.toMatch(/_ref = a\.(email|display_name)/);
  });
});

describe(`${FILE} — the two re-issued functions stay faithful`, () => {
  it('changes entitlement v2 ONLY by adding the carryover term', () => {
    expect(sql).toMatch(/v_carry numeric := 0/);
    expect(sql).toMatch(/v_used := v_new \+ v_legacy \+ v_carry/);
    // The canonical 04:00 window anchor from BUILD 24 must be preserved verbatim.
    expect(sql).toMatch(/v_anchor := date\(v_local - make_interval\(hours => p\.reset_hour_local\)\)/);
    expect(priorSql).toMatch(/v_used := v_new \+ v_legacy;/);
  });

  it('changes begin_song_v2 ONLY by the retired guard and the carryover grace clause', () => {
    expect(sql).toMatch(
      /not exists \(\s*\n\s*select 1 from public\.karaoke_free_window_carryover c[\s\S]*?c\.grace_consumed\)/,
    );
    // Admission arithmetic must be byte-identical to the deployed version.
    for (const pin of [
      "v_charge   := ceil(extract(epoch from (v_new_end - v_active)))::int;",
      "if v_dur is null or v_dur < 1 or v_dur > 900 then",
      "if v_remaining > 0 and v_shortfall <= 90 and not exists (",
    ]) {
      expect(sql).toContain(pin);
      expect(priorSql).toContain(pin);
    }
  });

  it('does not weaken the once-per-window grace it inherited', () => {
    expect(sql).toMatch(/g\.account_id = v_account and g\.charged_window_start = v_ws/);
  });
});

describe(`${FILE} — Apple revocation authority (BUILD 26E revision)`, () => {
  it('creates the durable provider-revocation job with the permitted status model', () => {
    expect(sql).toMatch(/create table if not exists public\.karaoke_provider_revocation_jobs/);
    expect(sql).toMatch(
      /check \(status in \('prepared', 'pending', 'succeeded',\s*\n?\s*'retryable_failure', 'manual_required'\)\)/,
    );
  });

  it('binds the job to the tombstone with RESTRICT, never CASCADE', () => {
    const block = sql.slice(
      sql.indexOf('create table if not exists public.karaoke_provider_revocation_jobs'),
      sql.indexOf('karaoke_provider_revocation_jobs_acct_provider_idx'),
    );
    expect(block).toMatch(/references public\.karaoke_accounts\(id\) on delete restrict/);
    expect(block).not.toMatch(/on delete cascade/);
  });

  it('makes token erasure in a terminal state a SCHEMA guarantee, not a code habit', () => {
    expect(sql).toMatch(
      /provider_revocation_terminal_has_no_token check \(\s*\n?\s*status not in \('succeeded', 'manual_required'\)\s*\n?\s*or \(encrypted_refresh_token is null and token_nonce is null\)\)/,
    );
  });

  it('keeps ciphertext and IV as one inseparable fact', () => {
    expect(sql).toMatch(
      /provider_revocation_token_pair check \(\s*\n?\s*\(encrypted_refresh_token is null\) = \(token_nonce is null\)\)/,
    );
  });

  it('stores a key version so the encryption key can be rotated', () => {
    expect(sql).toMatch(/encryption_key_version\s+text/);
  });

  it('never stores a raw/plaintext token column', () => {
    const block = sql.slice(
      sql.indexOf('create table if not exists public.karaoke_provider_revocation_jobs'),
      sql.indexOf('karaoke_provider_revocation_jobs_acct_provider_idx'),
    );
    expect(block).not.toMatch(/\brefresh_token\s+text/); //           only encrypted_refresh_token
    expect(block).not.toMatch(/plaintext|access_token|client_secret|authorization_code/);
  });

  it('allows at most ONE job per account per provider (a retry never fans out)', () => {
    expect(sql).toMatch(
      /karaoke_provider_revocation_jobs_acct_provider_idx[\s\S]*?\(account_id, provider\)/,
    );
  });

  it('adds an APPEND-ONLY post-deletion event log so later outcomes stay recordable', () => {
    // Without this the immutable audit could only ever assert the deletion-time snapshot,
    // and a revocation that succeeds hours later could never be reconciled.
    expect(sql).toMatch(/create table if not exists public\.karaoke_account_deletion_events/);
    expect(sql).toMatch(
      /before update or delete on public\.karaoke_account_deletion_events[\s\S]*?for each row/,
    );
    for (const evt of [
      'APPLE_REVOCATION_SUCCEEDED',
      'APPLE_REVOCATION_RETRYABLE_FAILURE',
      'APPLE_REVOCATION_MANUAL_REQUIRED',
    ]) {
      expect(sql).toContain(evt);
    }
  });

  it('keeps the event log free of PII and of Apple response bodies', () => {
    const block = sql.slice(
      sql.indexOf('create table if not exists public.karaoke_account_deletion_events'),
      sql.indexOf('karaoke_account_deletion_events_account_idx'),
    );
    for (const forbidden of ['email', 'display_name', 'provider_subject', 'token']) {
      expect(block).not.toMatch(new RegExp(forbidden));
    }
    // A short machine code only — a bounded column cannot hold an error body.
    expect(block).toMatch(/char_length\(detail_code\) <= 64/);
  });

  it('no longer encodes "revocation unavailable" as a normal-path outcome', () => {
    // The Founder rule: missing configuration is a DEPLOYMENT blocker, never something a
    // user's permanent audit records as having happened to them.
    expect(sql).not.toMatch(/unavailable_missing_credentials/);
  });
});
