// iPad Karaoke Display — the quiet "song board" that sits by the microphone.
// PUBLIC, read-only: it shows only what the room already sees (guest QR, who's
// singing, who's next, and the selected video). No credential, no mutation, no
// DJ controls. The room's slug in the URL is public; nothing secret is rendered.

import { getPublicRoomBySlug } from '@/lib/rooms.server';
import { getEventByRoomId } from '@/lib/events.server';
import { PRODUCT_NAME } from '@/lib/brand';
import DisplayClient from './DisplayClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);

  if (!room) {
    return (
      <main>
        <div className="brand-head">
          <span className="brand">{PRODUCT_NAME}</span>
        </div>
        <div className="card hero">
          <div className="display-sm">Room not found</div>
          <p className="lead">No room exists for “{slug}”.</p>
        </div>
      </main>
    );
  }

  // Prefer the event name (what guests see) when this room belongs to an event.
  const event = await getEventByRoomId(room.id);
  return <DisplayClient slug={room.slug} roomName={event?.name ?? room.display_name} />;
}
