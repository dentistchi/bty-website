// Server-only data access for karaoke "nights" (sessions). A room has at most
// one active session at a time (enforced by a partial unique index). Guests may
// only submit while a session is active; ending a night preserves history.

import { karaokeDb } from './supabase.server';

export interface KaraokeSession {
  id: string;
  room_id: string;
  status: 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
}

const SESSION_COLS = 'id, room_id, status, started_at, ended_at';

/** The room's currently-active session, or null if the night hasn't started. */
export async function getActiveSession(roomId: string): Promise<KaraokeSession | null> {
  const { data, error } = await karaokeDb()
    .from('karaoke_sessions')
    .select(SESSION_COLS)
    .eq('room_id', roomId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return (data as KaraokeSession) ?? null;
}

/** True if the room has ever had a session (used for backward-compat gating). */
export async function hasAnySession(roomId: string): Promise<boolean> {
  const { count, error } = await karaokeDb()
    .from('karaoke_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Start (or return the already-active) session for a room. The partial unique
 * index guarantees at most one active row; on the rare insert race we fall back
 * to reading the winner.
 */
export async function startSession(roomId: string): Promise<KaraokeSession> {
  const existing = await getActiveSession(roomId);
  if (existing) return existing;

  const { data, error } = await karaokeDb()
    .from('karaoke_sessions')
    .insert({ room_id: roomId, status: 'active' })
    .select(SESSION_COLS)
    .single();
  if (error) {
    // Unique-violation → another request just started it; return that one.
    const raced = await getActiveSession(roomId);
    if (raced) return raced;
    throw error;
  }
  return data as KaraokeSession;
}

/** End the active session (idempotent — no-op if none active). */
export async function endSession(roomId: string): Promise<KaraokeSession | null> {
  const active = await getActiveSession(roomId);
  if (!active) return null;
  const { data, error } = await karaokeDb()
    .from('karaoke_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', active.id)
    .eq('status', 'active')
    .select(SESSION_COLS)
    .maybeSingle();
  if (error) throw error;
  return (data as KaraokeSession) ?? null;
}

export interface RequestAcceptance {
  ok: boolean;
  sessionId: string | null;
}

/**
 * Whether the room is accepting guest requests right now, and which session to
 * stamp. Backward-compatible: a room that has never used the session model
 * (no session rows) keeps accepting requests with a null session_id. Once the
 * session model is in use, requests are accepted ONLY while a night is active.
 */
export async function requestAcceptance(roomId: string): Promise<RequestAcceptance> {
  const active = await getActiveSession(roomId);
  if (active) return { ok: true, sessionId: active.id };
  const ever = await hasAnySession(roomId);
  return { ok: !ever, sessionId: null };
}
