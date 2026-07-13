// Secure local bootstrap for a production btyNorebang room.
//
// Generates a cryptographically strong DJ credential, stores ONLY its SHA-256
// hash in Supabase (karaoke_rooms.dj_secret), and writes the RAW credential
// exactly once to a git-ignored local file for the operator to hand to the
// authorized iPad. The raw credential is NEVER printed to stdout or committed.
//
// Usage:
//   node scripts/create-room.mjs <slug> "<Display Name>" [--rotate]
//     e.g. node scripts/create-room.mjs bty-home "btyNorebang"
//   --rotate: regenerate the credential for an existing room (revokes old devices).

import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';

const slug = process.argv[2];
const displayName = process.argv[3];
const rotate = process.argv.includes('--rotate');

if (!slug || !displayName) {
  console.error('Usage: node scripts/create-room.mjs <slug> "<Display Name>" [--rotate]');
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
if (!URL_ || !KEY) {
  console.error('❌ Missing Supabase env in .dev.vars');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };

const existing = await (
  await fetch(`${URL_}/rest/v1/karaoke_rooms?slug=eq.${encodeURIComponent(slug)}&select=id,dj_secret`, {
    headers: H,
  })
).json();
const roomExists = Array.isArray(existing) && existing.length > 0;

if (roomExists && !rotate) {
  // Ensure display/status without touching the credential (produce-once).
  await fetch(`${URL_}/rest/v1/karaoke_rooms?slug=eq.${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ display_name: displayName, status: 'open' }),
  });
  console.log(`ℹ️  Room "${slug}" already exists — display/status ensured, credential unchanged.`);
  console.log('   Use --rotate to issue a new credential (revokes current devices).');
  process.exit(0);
}

const credential = randomBytes(24).toString('base64url'); // 192-bit
const hash = createHash('sha256').update(credential).digest('hex');

const body = JSON.stringify({ slug, display_name: displayName, status: 'open', dj_secret: hash });
const res = await fetch(`${URL_}/rest/v1/karaoke_rooms?on_conflict=slug`, {
  method: 'POST',
  headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
  body,
});
if (!res.ok) {
  console.error(`❌ Upsert failed: ${res.status} ${res.statusText}`);
  console.error(await res.text());
  process.exit(1);
}

const outFile = new URL(`../.dj-credential-${slug}.local`, import.meta.url);
writeFileSync(outFile, `${credential}\n`, { mode: 0o600 });
try {
  chmodSync(outFile, 0o600);
} catch {
  /* best effort */
}

console.log(`✅ Room "${slug}" ready (display: ${displayName}, status: open).`);
console.log('   Only the credential HASH is stored in Supabase.');
console.log(`   RAW credential written once to: .dj-credential-${slug}.local (git-ignored, 0600).`);
console.log('   Hand it to the authorized iPad from that file. It is not printed here.');
