// Shared read model for the slug-free Admin mobile app. Composes a room's public
// identity with its ONE canonical live event (draft|active) so both the
// enroll-by-PIN and token-restore endpoints return the same context shape. No
// secrets: slug + display name + status + the live event's public identity only.

import { getCanonicalEvent } from './events.server';
import type { PublicRoom } from './rooms.server';

export interface AdminRoomContext {
  slug: string;
  displayName: string;
  status: string;
  hasActiveEvent: boolean;
  activeEvent: { id: string; name: string; status: string } | null;
}

/** Build the public admin context for a room (room identity + canonical event). */
export async function buildAdminRoomContext(room: PublicRoom): Promise<AdminRoomContext> {
  const event = await getCanonicalEvent(room.id);
  return {
    slug: room.slug,
    displayName: room.display_name,
    status: room.status,
    hasActiveEvent: event != null,
    activeEvent: event ? { id: event.id, name: event.name, status: event.status } : null,
  };
}
