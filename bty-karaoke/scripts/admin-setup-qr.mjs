// Mac one-time Admin enrollment. Mints a single-use, 10-minute admin-setup nonce
// (only its hash is stored, in the ISOLATED karaoke_admin_setup_tokens table) and
// writes a QR pointing at:
//   <base>/r/<slug>/admin/setup#token=<nonce>
// The nonce lives ONLY in the QR (a URL FRAGMENT — never sent to the server on
// navigation). The RAW nonce/URL is never printed. Scan it with the Admin iPhone;
// the setup screen reads the fragment, wipes it from the address bar, and POSTs it.
//
// Usage:
//   node scripts/admin-setup-qr.mjs <slug> [baseUrl] [out-basename]
//     e.g. node scripts/admin-setup-qr.mjs bty-home
//   default base: https://bty-karaoke.ywamer2022.workers.dev

import QRCode from 'qrcode';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';

const slug = process.argv[2];
const base = process.argv[3] || 'https://bty-karaoke.ywamer2022.workers.dev';
const out = process.argv[4] || `qr-admin-setup-${slug}`;
if (!slug) {
  console.error('Usage: node scripts/admin-setup-qr.mjs <slug> [baseUrl] [out-basename]');
  process.exit(1);
}

const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const v = Object.fromEntries(
  raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);
const URL_ = v.KARAOKE_SUPABASE_URL, KEY = v.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('❌ Missing Supabase env in .dev.vars'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };

// Resolve the room id.
const rooms = await (
  await fetch(`${URL_}/rest/v1/karaoke_rooms?slug=eq.${encodeURIComponent(slug)}&select=id`, { headers: H })
).json();
if (!Array.isArray(rooms) || rooms.length === 0) {
  console.error(`❌ No room "${slug}".`);
  process.exit(1);
}
const roomId = rooms[0].id;

// Mint the nonce: store ONLY its hash + a 10-minute expiry.
const token = randomBytes(24).toString('base64url'); // 192-bit
const tokenHash = createHash('sha256').update(token).digest('hex');
const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const ins = await fetch(`${URL_}/rest/v1/karaoke_admin_setup_tokens`, {
  method: 'POST',
  headers: { ...H, Prefer: 'return=minimal' },
  body: JSON.stringify({ room_id: roomId, token_hash: tokenHash, expires_at: expiresAt }),
});
if (!ins.ok) {
  console.error(`❌ Could not mint setup nonce: ${ins.status} ${ins.statusText}`);
  console.error(await ins.text());
  process.exit(1);
}

// The nonce goes in the URL FRAGMENT. Never printed.
const setupUrl = `${base}/r/${encodeURIComponent(slug)}/admin/setup#token=${token}`;
await QRCode.toFile(`${out}.png`, setupUrl, { width: 720, margin: 2, errorCorrectionLevel: 'M' });

console.log('✅ Admin setup QR generated (single-use, expires in 10 minutes).');
console.log(`   file: ${out}.png`);
console.log('   Scan it with the Admin iPhone, then set the Admin PIN on-screen.');
console.log('   The setup link and token are NOT printed here — only inside the QR.');
