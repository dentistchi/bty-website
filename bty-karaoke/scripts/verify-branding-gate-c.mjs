// Read-only Gate C pre/post snapshot. Prints branding_theme + logo pointer for
// chi-norebang and bty-home, plus Event counts. NEVER writes. NEVER prints keys.
//
// Run:  node scripts/verify-branding-gate-c.mjs   (from bty-karaoke/)

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
  console.error('❌ Missing KARAOKE_SUPABASE_URL / KARAOKE_SUPABASE_SERVICE_ROLE_KEY in .dev.vars');
  process.exit(1);
}
const h = { apikey: key, Authorization: `Bearer ${key}` };
const q = async (path) => (await fetch(`${url}/rest/v1/${path}`, { headers: h })).json();

const rooms = await q(
  'karaoke_rooms?select=id,slug,display_name,branding_theme,logo_object_key,logo_version&slug=in.(chi-norebang-xqjbyszq,bty-home)',
);
for (const r of rooms) {
  const events = await q(`karaoke_events?select=id&room_id=eq.${r.id}`);
  console.log(
    `\nRoom ${r.slug}\n  branding_theme = ${r.branding_theme}\n  logo_object_key = ${r.logo_object_key ?? '(none)'}\n  logo_version = ${r.logo_version ?? '(none)'}\n  events = ${events.length}`,
  );
}
console.log('');
