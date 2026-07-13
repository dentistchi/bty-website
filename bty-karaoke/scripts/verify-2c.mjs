// Read-only live-DB probe for the STEP 2C schema. Uses the service-role key via
// PostgREST (no DDL, no writes) to detect whether the migration is applied.
// Never prints secrets. Usage: node scripts/verify-2c.mjs

import { readFileSync } from 'node:fs';

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
  console.error('Missing Supabase env in .dev.vars');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function probe(path, label) {
  try {
    const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: H });
    if (res.ok) return { label, ok: true, note: `HTTP ${res.status}` };
    const body = await res.text();
    let msg = body;
    try {
      msg = JSON.parse(body).message ?? body;
    } catch {
      /* keep raw */
    }
    return { label, ok: false, note: `HTTP ${res.status}: ${msg.slice(0, 120)}` };
  } catch (e) {
    return { label, ok: false, note: String(e).slice(0, 120) };
  }
}

const checks = await Promise.all([
  probe('karaoke_sessions?select=id,room_id,status,started_at,ended_at&limit=0', 'karaoke_sessions'),
  probe(
    'karaoke_dj_devices?select=id,room_id,role,label,token_hash,status,created_at,last_used_at,revoked_at&limit=0',
    'karaoke_dj_devices',
  ),
  probe(
    'karaoke_pairing_tokens?select=id,room_id,token_hash,role,expires_at,redeemed_at,redeemed_device_id&limit=0',
    'karaoke_pairing_tokens',
  ),
  probe('karaoke_requests?select=session_id&limit=0', 'karaoke_requests.session_id'),
]);

let allOk = true;
for (const c of checks) {
  console.log(`${c.ok ? '✅' : '❌'} ${c.label.padEnd(28)} ${c.note}`);
  if (!c.ok) allOk = false;
}
console.log(allOk ? '\nMIGRATION APPLIED ✅' : '\nMIGRATION NOT (fully) APPLIED ❌');
process.exit(allOk ? 0 : 2);
