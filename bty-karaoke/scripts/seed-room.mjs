// Idempotent demo-room seeder for the isolated Karaoke Supabase project.
// Upserts a room with slug "demo" so /r/demo and the DJ view are usable.
// Reads .dev.vars for the service-role key and NEVER prints it.
//
// Run:  node scripts/seed-room.mjs   (from bty-karaoke/, after the migration is applied)

import { readFileSync } from 'node:fs';

const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const vars = Object.fromEntries(
  raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = vars.KARAOKE_SUPABASE_URL;
const key = vars.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Missing KARAOKE_SUPABASE_URL or KARAOKE_SUPABASE_SERVICE_ROLE_KEY in .dev.vars');
  process.exit(1);
}

const SLUG = 'demo';
const DJ_SECRET = 'demo-dj'; // room-level DJ code for local testing (not a platform secret)

const res = await fetch(`${url}/rest/v1/karaoke_rooms?on_conflict=slug`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=representation',
  },
  body: JSON.stringify({
    slug: SLUG,
    display_name: 'Demo Room',
    status: 'open',
    dj_secret: DJ_SECRET,
  }),
});

if (!res.ok) {
  console.error(`❌ Seed FAILED: ${res.status} ${res.statusText}`);
  console.error(await res.text());
  console.error('\nIf this is a 404/relation error, apply the migration first.');
  process.exit(1);
}

console.log('✅ Demo room ready.');
console.log(`   Guest: /r/${SLUG}`);
console.log(`   DJ:    /r/${SLUG}/dj?secret=${DJ_SECRET}`);
