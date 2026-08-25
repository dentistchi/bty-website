// BUILD 26U-R4E-R2A — the App Store Server API TEST-notification transport gate.
//
// OPERATOR UTILITY, not product code. It lives in scripts/ and is never imported by the app: it
// exists so a human can prove Apple can reach our endpoint, and nothing in the request path
// depends on it.
//
// It does three things and no more:
//   1. mint an App Store Server API JWT (ES256)
//   2. POST /inApps/v1/notifications/test        -> testNotificationToken
//   3. GET  /inApps/v1/notifications/test/{token} -> Apple's OWN delivery verdict
//
// SANDBOX ONLY. The base URL is hardcoded to the sandbox host; there is no flag that points it at
// production, because this build must not be able to touch the production notification path.
//
// SECRETS. Read from .dev.vars (gitignored) or the environment. The private key is never printed,
// never logged, and never sent anywhere except into the local ES256 signature. The JWT itself is
// printed only as a length.
//
// EVIDENCE RULE (carried from R4C/R4D/R4E): an empty measurement is a failure, an API error is a
// failure, and Apple's own recorded status is the only proof of delivery -- our endpoint returning
// 200 to a probe is not, and neither is a server log.

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';
const BUNDLE_ID = 'com.bty.BTYNorebangAdmin';

function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (t.slice(0, i).trim() === name) {
        // A .p8 stored on one line keeps its newlines as the two-character sequence \n.
        return t.slice(i + 1).trim().replace(/\\n/g, '\n');
      }
    }
  } catch { /* fall through to the explicit failure below */ }
  return null;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function mintJwt({ issuerId, keyId, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  // `bid` is required for App Store Server API tokens and scopes the token to this app alone.
  const payload = { iss: issuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1', bid: BUNDLE_ID };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  // ES256 requires the raw r||s pair, not the DER structure OpenSSL emits by default.
  const der = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${b64url(der)}`;
}

async function main() {
  const issuerId = env('KARAOKE_APPLE_IAP_ISSUER_ID');
  const keyId = env('KARAOKE_APPLE_IAP_KEY_ID');
  const privateKey = env('KARAOKE_APPLE_IAP_PRIVATE_KEY');

  const missing = [
    ['KARAOKE_APPLE_IAP_ISSUER_ID', issuerId],
    ['KARAOKE_APPLE_IAP_KEY_ID', keyId],
    ['KARAOKE_APPLE_IAP_PRIVATE_KEY', privateKey],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error('BLOCKED — credentials absent:', missing.join(', '));
    console.error('These are App Store Connect IN-APP PURCHASE key credentials.');
    console.error('They are NOT the KARAOKE_APPLE_REVOCATION_* Sign-in-with-Apple secrets.');
    process.exit(2);
  }
  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    console.error('BLOCKED — the private key is not a PKCS#8 PEM (.p8 contents expected).');
    process.exit(2);
  }

  let jwt;
  try {
    jwt = mintJwt({ issuerId, keyId, privateKey });
  } catch (e) {
    console.error('BLOCKED — could not sign the App Store Server API JWT:', e.message);
    process.exit(2);
  }
  console.log(`  A. JWT minted        ES256, kid=${keyId}, aud=appstoreconnect-v1, bid=${BUNDLE_ID}, ${jwt.length} chars`);

  // ---- B. ask Apple to deliver a TEST notification to the configured Sandbox URL ----
  const reqRes = await fetch(`${SANDBOX}/inApps/v1/notifications/test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
  });
  const reqText = await reqRes.text();
  if (reqRes.status === 401) {
    console.error(`  A. AUTH FAILED       HTTP 401 — Apple rejected the token. ${reqText.slice(0, 160)}`);
    process.exit(3);
  }
  if (!reqRes.ok) {
    console.error(`  B. REQUEST FAILED    HTTP ${reqRes.status} ${reqText.slice(0, 200)}`);
    process.exit(3);
  }
  let token;
  try { token = JSON.parse(reqText).testNotificationToken; } catch { token = null; }
  if (!token) {
    console.error(`  B. NO TOKEN          Apple returned 200 but no testNotificationToken: ${reqText.slice(0, 160)}`);
    process.exit(3);
  }
  console.log(`  A. AUTH OK           Apple accepted the App Store Server API token`);
  console.log(`  B. testNotificationToken  ${token.slice(0, 12)}…${token.slice(-6)}  (${token.length} chars)`);

  // ---- C. Apple's OWN verdict on whether it reached us ----
  // Delivery is asynchronous; Apple returns 404 until the attempt is recorded. Polled, not slept
  // once and hoped for.
  let status = null;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${SANDBOX}/inApps/v1/notifications/test/${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const text = await res.text();
    if (res.status === 404) { console.log(`     …attempt ${attempt}: Apple has not recorded a result yet`); continue; }
    if (!res.ok) { console.error(`  C. STATUS FAILED     HTTP ${res.status} ${text.slice(0, 200)}`); process.exit(4); }
    try { status = JSON.parse(text); } catch { status = null; }
    if (status) break;
  }
  if (!status) {
    console.error('  C. NO STATUS         Apple never recorded a delivery result within the polling window');
    process.exit(4);
  }

  const history = Array.isArray(status.sendAttempts) ? status.sendAttempts : [];
  console.log(`  C. Apple sendAttempts: ${history.length}`);
  for (const a of history) {
    console.log(`     attempt ${new Date(a.attemptDate).toISOString()}  result=${a.sendAttemptResult}`);
  }
  const delivered = history.some((a) => a.sendAttemptResult === 'SUCCESS');
  console.log(`  C. APPLE-RECORDED DELIVERY: ${delivered ? 'SUCCESS' : 'NOT SUCCESS'}`);
  // The signed payload Apple sent is echoed back in the status response, so what we received can
  // be compared against what Apple says it sent.
  if (status.signedPayload) {
    console.log(`  D. Apple echoed the signedPayload it delivered (${String(status.signedPayload).length} chars)`);
  }
  process.exit(delivered ? 0 : 5);
}

main().catch((e) => { console.error('BLOCKED — unexpected:', e.message); process.exit(1); });
