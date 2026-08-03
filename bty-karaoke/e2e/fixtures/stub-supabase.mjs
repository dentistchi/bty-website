// BUILD 26B — a local, test-only stand-in for the Karaoke PostgREST endpoint.
//
// WHY THIS EXISTS. The DJ console page resolves its room in a SERVER component
// (`getPublicRoomBySlug`), so browser-level request interception cannot reach it.
// Pointing KARAOKE_SUPABASE_URL at this stub lets the console render from a
// deterministic fixture with NO real credentials and NO production reads, so the
// suite runs from a clean checkout.
//
// IT IS NOT AN AUTH BYPASS. It never issues a session, never signs a capability
// and never touches shared production code. It is started only by
// playwright.config.ts, listens on loopback, and is unreachable from any
// deployed runtime — nothing imports it and it is outside the Next build graph.
import { createServer } from 'node:http';

const PORT = Number(process.env.STUB_PORT ?? 54329);

/** The one room the responsive suite renders. Mirrors PUBLIC_ROOM_COLS exactly. */
const ROOM = {
  id: '00000000-0000-4000-8000-00000000r00m'.replace(/r00m/, '0001'),
  slug: 'harness-room',
  display_name: 'Harness Room',
  status: 'open',
  guest_welcome_message: null,
  logo_object_key: null,
  logo_version: null,
  branding_theme: 'midnight_gold',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const single = (req.headers.accept ?? '').includes('vnd.pgrst.object');
  const send = (body, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === '/rest/v1/karaoke_rooms') {
    const slug = (url.searchParams.get('slug') ?? '').replace(/^eq\./, '');
    const hit = slug === ROOM.slug ? ROOM : null;
    return send(single ? hit : hit ? [hit] : [], 200);
  }
  // Every other table: an empty result. The suite drives all console state through
  // browser-level interception of /api/**, so nothing else needs to be modelled.
  return send(single ? null : [], 200);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stub-supabase] listening on http://127.0.0.1:${PORT}`);
});
