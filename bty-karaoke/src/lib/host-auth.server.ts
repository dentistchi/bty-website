// Host account / workspace / Room-ownership authorization (Host Account V1).
//
// This is the FIRST principal the product has ever had. Everything before it was
// a shared secret bound to a room or to the deployment; nothing identified a
// person. The rules here are deliberately boring and re-resolved on every call:
//
//   session token -> account -> ACTIVE workspace membership -> workspace owns Room
//
// Possession of a historical token is never sufficient. A revoked membership must
// take effect on the very next request, which is only true if authorization is
// resolved from these tables every time rather than baked into a credential.

import { karaokeDb } from './supabase.server';
import { sha256Hex, randomToken } from './dj-auth.server';
import { ensureDefaultFreePlan } from './host-plan.server';
import { buildRoomSlug } from '@/domain/room-slug';
import { normalizePlanCode, type PlanCode } from '@/domain/host-plan';

/** Durable native login. Long-lived on purpose, but revocable and expiring. */
export const HOST_SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface HostAccount {
  id: string;
  provider: string;
  provider_subject: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
}

const ACCOUNT_COLS = 'id, provider, provider_subject, email, display_name, created_at';

/** The privacy-appropriate projection the app may show. Never the provider subject. */
export function publicAccount(a: HostAccount) {
  return { id: a.id, email: a.email, displayName: a.display_name };
}

export type IdentityProvider = 'apple' | 'google';

/** Look up the account that owns a verified (provider, subject) identity. */
async function accountForIdentity(
  provider: IdentityProvider,
  subject: string,
): Promise<HostAccount | null> {
  const db = karaokeDb();
  const idRow = await db
    .from('karaoke_account_identities')
    .select('id, account_id')
    .eq('provider', provider)
    .eq('provider_subject', subject)
    .maybeSingle();
  if (idRow.error) throw idRow.error;
  if (!idRow.data) return null;

  const acct = await db
    .from('karaoke_accounts')
    .select(ACCOUNT_COLS)
    .eq('id', idRow.data.account_id as string)
    .maybeSingle();
  if (acct.error) throw acct.error;
  if (!acct.data) return null;

  void db
    .from('karaoke_account_identities')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', idRow.data.id as string)
    .then(() => undefined);

  return acct.data as HostAccount;
}

/**
 * Resolve the ONE canonical account for a verified external identity, creating the
 * account on first sign-in. PROVIDER-NEUTRAL (Cross-Platform Identity V1): identity
 * lives in karaoke_account_identities, so Apple and Google logins by the same
 * linked person resolve to the SAME account and therefore the same workspace.
 *
 * Idempotent by (provider, provider_subject) — the unique index makes a concurrent
 * double sign-in resolve to the same row rather than duplicating. Email is NEVER
 * used to match or merge accounts: two providers reporting one address does not
 * prove one person.
 */
export async function resolveAccountForIdentity(args: {
  provider: IdentityProvider;
  subject: string;
  email?: string | null;
  displayName?: string | null;
}): Promise<HostAccount> {
  const db = karaokeDb();
  const { provider, subject } = args;

  const existing = await accountForIdentity(provider, subject);
  if (existing) {
    void db
      .from('karaoke_accounts')
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .then(() => undefined);
    return existing;
  }

  // First sign-in with this identity → create the canonical account, then attach
  // the identity. The account row carries NO provider-specific key.
  const insert = await db
    .from('karaoke_accounts')
    .insert({
      email: args.email ?? null,
      display_name: args.displayName ?? null,
      last_login_at: new Date().toISOString(),
    })
    .select(ACCOUNT_COLS)
    .single();
  if (insert.error) throw insert.error;
  const account = insert.data as HostAccount;

  const link = await db.from('karaoke_account_identities').insert({
    account_id: account.id,
    provider,
    provider_subject: subject,
    email: args.email ?? null,
    last_used_at: new Date().toISOString(),
  });

  if (link.error) {
    // A concurrent sign-in won the identity race. Discard the account row we just
    // made (it owns nothing) and return the winner, so one identity never yields
    // two accounts.
    if ((link.error as { code?: string }).code === '23505') {
      void db.from('karaoke_accounts').delete().eq('id', account.id).then(() => undefined);
      const winner = await accountForIdentity(provider, subject);
      if (winner) return winner;
    }
    throw link.error;
  }

  // Host Plan Foundation V1: a brand-new canonical account gets exactly one active
  // FREE assignment at creation. Idempotent + non-fatal — it never blocks sign-in,
  // and returning accounts (the early return above) never re-provision, so repeated
  // logins add nothing.
  await ensureDefaultFreePlan(account.id);
  return account;
}

export type LinkOutcome =
  | { outcome: 'linked' | 'already_linked' }
  | { outcome: 'owned_by_other' };

/**
 * Deliberately link an additional verified identity to an ALREADY authenticated
 * account (§8). The caller must hold a valid Host session AND have just proved the
 * new provider identity — this function is the ownership boundary, not the
 * authentication boundary.
 *
 *  - identity already on THIS account → idempotent success;
 *  - identity owned by ANOTHER account → refused (never re-pointed or stolen);
 *  - otherwise attached atomically (single insert guarded by the unique index).
 *
 * Never matches on email, never changes workspace memberships, never touches Events.
 */
export async function linkIdentityToAccount(args: {
  accountId: string;
  provider: IdentityProvider;
  subject: string;
  email?: string | null;
}): Promise<LinkOutcome> {
  const db = karaokeDb();
  const existing = await db
    .from('karaoke_account_identities')
    .select('id, account_id')
    .eq('provider', args.provider)
    .eq('provider_subject', args.subject)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data) {
    return existing.data.account_id === args.accountId
      ? { outcome: 'already_linked' }
      : { outcome: 'owned_by_other' };
  }

  const insert = await db.from('karaoke_account_identities').insert({
    account_id: args.accountId,
    provider: args.provider,
    provider_subject: args.subject,
    email: args.email ?? null,
    last_used_at: new Date().toISOString(),
  });
  if (insert.error) {
    // Lost a concurrent race — re-read to report the truthful outcome. A failed
    // link leaves no partial row.
    if ((insert.error as { code?: string }).code === '23505') {
      const winner = await db
        .from('karaoke_account_identities')
        .select('account_id')
        .eq('provider', args.provider)
        .eq('provider_subject', args.subject)
        .maybeSingle();
      if (winner.data) {
        return winner.data.account_id === args.accountId
          ? { outcome: 'already_linked' }
          : { outcome: 'owned_by_other' };
      }
    }
    throw insert.error;
  }
  return { outcome: 'linked' };
}

/** The Host's connected login methods, for the "Login methods" settings UI. */
export async function listAccountIdentities(
  accountId: string,
): Promise<Array<{ provider: IdentityProvider; createdAt: string }>> {
  const { data, error } = await karaokeDb()
    .from('karaoke_account_identities')
    .select('provider, created_at')
    .eq('account_id', accountId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    provider: r.provider as IdentityProvider,
    createdAt: r.created_at as string,
  }));
}

/** Mint an opaque session. Only the SHA-256 hash is stored. */
export async function createHostSession(
  accountId: string,
  nowMs = Date.now(),
): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken(32);
  const expiresAt = new Date(nowMs + HOST_SESSION_TTL_MS).toISOString();
  const { error } = await karaokeDb().from('karaoke_host_sessions').insert({
    account_id: accountId,
    token_hash: await sha256Hex(token),
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { token, expiresAt };
}

/**
 * Resolve a bearer session token to its account. Returns null for unknown,
 * revoked, or expired sessions — the three are indistinguishable to the caller on
 * purpose, so a probe cannot learn whether a token ever existed.
 */
export async function authorizeHost(rawToken: string | null): Promise<HostAccount | null> {
  if (!rawToken) return null;
  const db = karaokeDb();
  const { data, error } = await db
    .from('karaoke_host_sessions')
    .select('id, account_id, status, expires_at')
    .eq('token_hash', await sha256Hex(rawToken))
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'active') return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;

  const acct = await db
    .from('karaoke_accounts')
    .select(ACCOUNT_COLS)
    .eq('id', data.account_id as string)
    .maybeSingle();
  if (acct.error) throw acct.error;
  if (!acct.data) return null;

  void db
    .from('karaoke_host_sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id as string)
    .then(() => undefined);

  return acct.data as HostAccount;
}

/** Sign out THIS session only. Other devices of the same Host keep working. */
export async function revokeHostSession(rawToken: string | null): Promise<void> {
  if (!rawToken) return;
  const { error } = await karaokeDb()
    .from('karaoke_host_sessions')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('token_hash', await sha256Hex(rawToken))
    .eq('status', 'active');
  if (error) throw error;
}

/** The workspace that owns a Room, or null when the Room is unclaimed. */
export async function roomOwnerWorkspace(roomId: string): Promise<string | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_room_ownership')
    .select('workspace_id')
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) throw error;
  return (data?.workspace_id as string | undefined) ?? null;
}

/**
 * THE room authorization predicate: does this account currently hold an ACTIVE
 * membership in the workspace that owns this Room?
 *
 * Returns false for an unclaimed Room — an unowned Room has no workspace to be a
 * member of, so account-scoped access is meaningless there (the legacy
 * room-credential path still governs it; see assertDeviceRoomAccess).
 */
export async function accountHasRoomAccess(accountId: string, roomId: string): Promise<boolean> {
  const workspaceId = await roomOwnerWorkspace(roomId);
  if (!workspaceId) return false;
  const { data, error } = await karaokeDb()
    .from('karaoke_workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('account_id', accountId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

export interface HostRoomCard {
  slug: string;
  displayName: string;
  status: string;
  hasActiveEvent: boolean;
  activeEvent: { id: string; name: string; status: string; startsAt: string | null } | null;
  queueCount: number;
}

/**
 * The My Norebang listing: every Room owned by a workspace this account is an
 * ACTIVE member of, with live server truth for the Room card. Purely read-only —
 * opening My Norebang must never create a workspace, a Room, or an Event.
 */
export async function listHostRooms(accountId: string): Promise<HostRoomCard[]> {
  const db = karaokeDb();

  const memberships = await db
    .from('karaoke_workspace_members')
    .select('workspace_id')
    .eq('account_id', accountId)
    .eq('status', 'active');
  if (memberships.error) throw memberships.error;
  const workspaceIds = (memberships.data ?? []).map((m) => m.workspace_id as string);
  if (workspaceIds.length === 0) return [];

  const owned = await db
    .from('karaoke_room_ownership')
    .select('room_id')
    .in('workspace_id', workspaceIds);
  if (owned.error) throw owned.error;
  const roomIds = (owned.data ?? []).map((o) => o.room_id as string);
  if (roomIds.length === 0) return [];

  const rooms = await db
    .from('karaoke_rooms')
    .select('id, slug, display_name, status')
    .in('id', roomIds);
  if (rooms.error) throw rooms.error;

  // Live events for these rooms (draft|active is the canonical "live" set).
  const events = await db
    .from('karaoke_events')
    .select('id, room_id, name, status, starts_at')
    .in('room_id', roomIds)
    .in('status', ['draft', 'active']);
  if (events.error) throw events.error;
  const liveByRoom = new Map<string, { id: string; name: string; status: string; starts_at: string | null }>();
  for (const e of events.data ?? []) {
    liveByRoom.set(e.room_id as string, e as never);
  }

  // Active queue counts, scoped to each live event (never room-wide history).
  const liveEventIds = [...liveByRoom.values()].map((e) => e.id);
  const countByEvent = new Map<string, number>();
  if (liveEventIds.length > 0) {
    const reqs = await db
      .from('karaoke_requests')
      .select('event_id, status')
      .in('event_id', liveEventIds)
      .in('status', ['waiting', 'playing']);
    if (reqs.error) throw reqs.error;
    for (const r of reqs.data ?? []) {
      const k = r.event_id as string;
      countByEvent.set(k, (countByEvent.get(k) ?? 0) + 1);
    }
  }

  return (rooms.data ?? []).map((r) => {
    const live = liveByRoom.get(r.id as string) ?? null;
    return {
      slug: r.slug as string,
      displayName: r.display_name as string,
      status: r.status as string,
      hasActiveEvent: live != null,
      activeEvent: live
        ? { id: live.id, name: live.name, status: live.status, startsAt: live.starts_at }
        : null,
      queueCount: live ? (countByEvent.get(live.id) ?? 0) : 0,
    };
  });
}

export type ClaimOutcome =
  | { outcome: 'claimed' | 'idempotent'; workspaceId: string; roomId: string }
  | { outcome: 'conflict' }
  | { outcome: 'no_room' };

/**
 * Atomically claim a Room for this account's workspace via the claim_karaoke_room
 * RPC. The Manager passcode MUST already have been verified by the caller — this
 * is the atomicity boundary, not the authentication boundary. Never creates an
 * Event.
 */
export async function claimRoomForAccount(args: {
  accountId: string;
  roomId: string;
  workspaceName?: string | null;
}): Promise<ClaimOutcome> {
  const { data, error } = await karaokeDb().rpc('claim_karaoke_room', {
    p_account_id: args.accountId,
    p_room_id: args.roomId,
    p_workspace_name: args.workspaceName ?? 'My Norebang',
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as ClaimOutcome | null;
  if (!row) return { outcome: 'no_room' };
  return row;
}

/** A URL-safe, lowercase random slug suffix (base36) from a CSPRNG. Carries the
 *  global-uniqueness weight of a Room slug so the readable name-derived prefix
 *  never has to. */
function randomSlugSuffix(chars = 8): string {
  const bytes = new Uint8Array(chars);
  crypto.getRandomValues(bytes);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (const b of bytes) s += alphabet[b % 36];
  return s;
}

export type FirstRoomOutcome = { outcome: 'created' | 'has_room'; slug: string; roomId: string };

/**
 * First-room onboarding (New Host Onboarding V1). Create THIS account's first Room
 * and its ownership graph atomically via the create_karaoke_room RPC, deriving the
 * canonical slug server-side from the Host's display name plus a CSPRNG suffix.
 *
 *  - 'created'  — a brand-new Room + ownership (and workspace/membership if needed).
 *  - 'has_room' — the account already owns a Room; the RPC returns THAT Room's slug
 *                 instead of minting a duplicate (rule F, enforced under an account-
 *                 scoped advisory lock so a double submit yields exactly one Room).
 *
 * The owner is ALWAYS the passed accountId (derived from the authenticated Host
 * session by the caller); no client-supplied owner is ever accepted. Creates ZERO
 * Events. A slug collision (23505) is retried with a fresh suffix.
 */
export async function createFirstRoomForAccount(args: {
  accountId: string;
  displayName: string;
}): Promise<FirstRoomOutcome> {
  const db = karaokeDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = buildRoomSlug(args.displayName, randomSlugSuffix());
    // A random, un-returned master credential: NOT NULL is satisfied while the
    // shared-secret path stays effectively disabled — this Room is reached only
    // through the account-bound Room web session, never a passcode nobody holds.
    const djSecret = await sha256Hex(randomToken(32));
    const { data, error } = await db.rpc('create_karaoke_room', {
      p_account_id: args.accountId,
      p_slug: slug,
      p_display_name: args.displayName,
      p_dj_secret: djSecret,
      p_workspace_name: 'My Norebang',
    });
    if (error) {
      // 23505 = the generated slug collided with an existing Room. Retry a fresh one.
      if ((error as { code?: string }).code === '23505') continue;
      throw error;
    }
    const row = (Array.isArray(data) ? data[0] : data) as {
      outcome: 'created' | 'has_room';
      slug: string;
      roomId: string;
    };
    return { outcome: row.outcome, slug: row.slug, roomId: row.roomId };
  }
  throw new Error('Could not allocate a unique room slug after several attempts');
}

/**
 * Count the account's currently-owned active Rooms. Cheap (no event/queue joins) — it
 * exists only to ROUTE creation (0 → first-Room path, ≥1 → additional-Room path). It is
 * NOT the limit authority: the additional-Room RPC re-counts under the account lock and
 * enforces the plan cap there, so this read is never trusted for enforcement.
 */
export async function countOwnedRooms(accountId: string): Promise<number> {
  const db = karaokeDb();
  const memberships = await db
    .from('karaoke_workspace_members')
    .select('workspace_id')
    .eq('account_id', accountId)
    .eq('status', 'active');
  if (memberships.error) throw memberships.error;
  const workspaceIds = (memberships.data ?? []).map((m) => m.workspace_id as string);
  if (workspaceIds.length === 0) return 0;
  const { count, error } = await db
    .from('karaoke_room_ownership')
    .select('*', { count: 'exact', head: true })
    .in('workspace_id', workspaceIds);
  if (error) throw error;
  return count ?? 0;
}

export type AdditionalRoomOutcome =
  | { outcome: 'created'; slug: string; roomId: string; count: number; max: number }
  | { outcome: 'limit_reached'; plan: PlanCode; count: number; max: number }
  | { outcome: 'first_room_required' } //     zero owned → create_karaoke_room is the sole 0→1 path
  | { outcome: 'ownership_state_invalid' } //  owns a Room but has no active workspace (broken graph)
  | { outcome: 'account_not_found' };

/**
 * PRO Multi-Room V1. Create an ADDITIONAL Room for an account that already owns one,
 * within its plan's Room limit, via the atomic create_additional_karaoke_room RPC. The
 * plan and the FREE=1 / PRO=3 cap are resolved INSIDE the locked transaction — this
 * caller passes NO limit and cannot inflate it. The RPC fails CLOSED with zero writes on
 * 'first_room_required' (zero owned) and 'ownership_state_invalid' (missing workspace);
 * 'limit_reached' means at capacity. Only 'created' mints a Room; existing Rooms are
 * always untouched. Creates ZERO Events. A slug collision (23505) retries a fresh suffix.
 */
export async function createAdditionalRoomForAccount(args: {
  accountId: string;
  displayName: string;
}): Promise<AdditionalRoomOutcome> {
  const db = karaokeDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = buildRoomSlug(args.displayName, randomSlugSuffix());
    const djSecret = await sha256Hex(randomToken(32));
    const { data, error } = await db.rpc('create_additional_karaoke_room', {
      p_account_id: args.accountId,
      p_slug: slug,
      p_display_name: args.displayName,
      p_dj_secret: djSecret,
    });
    if (error) {
      if ((error as { code?: string }).code === '23505') continue; // slug clash → retry
      throw error;
    }
    const row = (Array.isArray(data) ? data[0] : data) as {
      outcome: string;
      slug?: string;
      roomId?: string;
      plan?: string;
      count?: number;
      max?: number;
    };
    if (row.outcome === 'created') {
      return { outcome: 'created', slug: row.slug!, roomId: row.roomId!, count: row.count ?? 0, max: row.max ?? 0 };
    }
    if (row.outcome === 'limit_reached') {
      return { outcome: 'limit_reached', plan: normalizePlanCode(row.plan), count: row.count ?? 0, max: row.max ?? 0 };
    }
    if (row.outcome === 'first_room_required') return { outcome: 'first_room_required' };
    if (row.outcome === 'ownership_state_invalid') return { outcome: 'ownership_state_invalid' };
    return { outcome: 'account_not_found' };
  }
  throw new Error('Could not allocate a unique room slug after several attempts');
}

export type CreateRoomResult =
  | { kind: 'entered'; slug: string; roomId: string } // first Room (created or has_room) → enter Admin
  | { kind: 'added'; slug: string; roomId: string } //   additional Room created → return to chooser
  | { kind: 'limit_reached' }; //                        at capacity → no Room created

/**
 * The single creation entry the Host route calls. Routes by owned-Room count WITHOUT
 * changing first-Room behavior: 0 owned → the unchanged create_karaoke_room path (enter
 * Admin); ≥1 owned → the plan-capped additional-Room path (return to the chooser, or
 * 'limit_reached'). The count here only picks the path; both paths re-check under the
 * account lock, so a concurrent race can never exceed the cap. account_not_found (a
 * near-impossible inconsistency for an authenticated Host) is treated as 'limit_reached'
 * — no Room is created and the Host is returned to the hub.
 */
export async function createRoomForAccount(args: {
  accountId: string;
  displayName: string;
}): Promise<CreateRoomResult> {
  const owned = await countOwnedRooms(args.accountId);
  if (owned === 0) {
    const r = await createFirstRoomForAccount(args);
    return { kind: 'entered', slug: r.slug, roomId: r.roomId };
  }
  const r = await createAdditionalRoomForAccount(args);
  if (r.outcome === 'created') return { kind: 'added', slug: r.slug, roomId: r.roomId };
  return { kind: 'limit_reached' };
}

/** Bind a device credential to the Host who enrolled it (subordinate credential). */
export async function bindDeviceToAccount(deviceId: string, accountId: string): Promise<void> {
  const { error } = await karaokeDb()
    .from('karaoke_dj_devices')
    .update({ account_id: accountId })
    .eq('id', deviceId);
  if (error) throw error;
}
