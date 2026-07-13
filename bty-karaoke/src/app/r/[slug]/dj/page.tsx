import { getPublicRoomBySlug } from '@/lib/rooms.server';
import DjConsole from './DjConsole';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The DJ page renders only a shell. Auth happens client-side against the server;
// no credential is ever placed in the URL or the server-rendered HTML.
export default async function DjPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getPublicRoomBySlug(slug);

  if (!room) {
    return (
      <main>
        <h1>Room not found</h1>
        <p className="muted">No room exists for “{slug}”.</p>
      </main>
    );
  }

  // DjConsole owns its own <main> per phase (wide for the authed console,
  // narrow for the pairing/disconnected states).
  return (
    <DjConsole
      slug={room.slug}
      displayName={room.display_name}
      dev={process.env.NODE_ENV === 'development'}
    />
  );
}
