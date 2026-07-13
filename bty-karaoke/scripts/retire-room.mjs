// Retire a room: set status=closed AND rotate its DJ credential hash to a fresh
// random value that is immediately discarded. Any previously known code (e.g.
// the exposed demo-dj) can no longer authorize — verify returns 401 — and new
// guest submissions are rejected (the API refuses non-open rooms).
//
// Usage: node scripts/retire-room.mjs <slug>   e.g. node scripts/retire-room.mjs demo

import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/retire-room.mjs <slug>');
  process.exit(1);
}

const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const v = Object.fromEntries(
  raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const URL_ = v.KARAOKE_SUPABASE_URL;
const KEY = v.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };

// Fresh random hash, raw discarded — nobody holds a matching credential.
const deadHash = createHash('sha256').update(randomBytes(32)).digest('hex');

const res = await fetch(`${URL_}/rest/v1/karaoke_rooms?slug=eq.${encodeURIComponent(slug)}`, {
  method: 'PATCH',
  headers: { ...H, Prefer: 'return=representation' },
  body: JSON.stringify({ status: 'closed', dj_secret: deadHash, closed_at: new Date().toISOString() }),
});
if (!res.ok) {
  console.error(`❌ Retire failed: ${res.status} ${res.statusText}`);
  console.error(await res.text());
  process.exit(1);
}
const rows = await res.json();
if (!rows.length) {
  console.error(`❌ No room "${slug}" found.`);
  process.exit(1);
}
console.log(`✅ Room "${slug}" retired: status=closed, DJ credential rotated (old codes now 401).`);
