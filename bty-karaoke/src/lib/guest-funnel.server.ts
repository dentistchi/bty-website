// Server-only Guest-to-App web funnel recorder (BUILD 19C). Append-only, privacy-clean: stores
// only the event type + already-public room/event/request/handoff ids — never a raw token, guest
// name, or provider identity. Best-effort: a failed insert never blocks the guest flow. The
// RESOLUTION funnel (created/opened/resolved) stays in the BUILD 19B handoff audit; this records
// the WEB touchpoints (invite shown / app-open tapped / continue-web).

import { karaokeDb } from './supabase.server';
import { getPublicRoomBySlug } from './rooms.server';
import { GUEST_FUNNEL_EVENTS, type GuestFunnelEvent } from '@/domain/app-invite';

export function isGuestFunnelEvent(x: unknown): x is GuestFunnelEvent {
  return typeof x === 'string' && (GUEST_FUNNEL_EVENTS as readonly string[]).includes(x);
}

export async function recordGuestFunnelEvent(args: {
  eventType: GuestFunnelEvent;
  handoffId?: string | null;
  roomSlug?: string | null;
  requestId?: string | null;
  platform?: string | null;
}): Promise<void> {
  const db = karaokeDb();
  let room_id: string | null = null;
  let event_id: string | null = null;

  // Resolve the public ids best-effort (for joining to the handoff audit); never identity.
  if (args.roomSlug) {
    const room = await getPublicRoomBySlug(args.roomSlug);
    room_id = room?.id ?? null;
  }
  if (args.requestId) {
    const { data } = await db
      .from('karaoke_requests')
      .select('room_id, event_id')
      .eq('id', args.requestId)
      .maybeSingle();
    if (data) {
      room_id = room_id ?? (data.room_id as string);
      event_id = (data.event_id as string | null) ?? null;
    }
  }

  try {
    await db.from('karaoke_guest_funnel_events').insert({
      event_type: args.eventType,
      handoff_id: args.handoffId ?? null,
      room_id,
      event_id,
      source_request_id: args.requestId ?? null,
      platform: args.platform ?? 'web',
    });
  } catch {
    /* best-effort analytics — never blocks the guest flow */
  }
}
