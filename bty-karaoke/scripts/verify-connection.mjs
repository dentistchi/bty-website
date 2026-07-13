// Zero-dependency connection verifier for the isolated Karaoke Supabase project.
// Reads .dev.vars, hits PostgREST with the service-role key, and confirms the
// schema is reachable. It NEVER prints the key.
//
// Run:  node scripts/verify-connection.mjs   (from bty-karaoke/)

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

const res = await fetch(`${url}/rest/v1/karaoke_rooms?select=id&limit=1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});

if (!res.ok) {
  console.error(`❌ Connection FAILED: ${res.status} ${res.statusText}`);
  console.error(await res.text());
  console.error('\nIf this is a 404/relation error, the migration has not been applied yet.');
  process.exit(1);
}

const rows = await res.json();
console.log(`✅ Connection OK. Reached project ${new URL(url).host}.`);
console.log(`   karaoke_rooms is queryable — ${rows.length} row(s) returned (expect 0 before seeding).`);
