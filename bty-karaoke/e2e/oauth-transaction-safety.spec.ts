// BUILD 26B G6 Part B — expired / invalid OAuth transaction safety.
//
// The callback checks `transactionExpired(tx)` BEFORE it exchanges the code, so an
// expired attempt is refused without contacting Google and without minting anything.
// That is what makes this verifiable offline and deterministically: the transaction
// cookie is plain JSON carrying `createdAt`, so a backdated value reproduces a
// ten-minute-old attempt instantly. No Founder wait, no callback-URL edit, no
// OAuth-state manipulation by hand, no real Google account.
//
// These tests assert refusal, not success — they must never mint a Host session.
import { test, expect } from '@playwright/test';
import { BASE_URL } from '../playwright.config';

const TX_COOKIE = 'bty_host_oauth';
const HOST_COOKIE = 'bty_host';
const TTL_MS = 10 * 60 * 1000;

/** A well-formed transaction, aged by `ageMs`. */
function tx(ageMs: number, state = 'state-under-test') {
  return JSON.stringify({
    state,
    verifier: 'verifier-not-a-real-secret',
    nonce: 'nonce-not-a-real-secret',
    returnTo: '/',
    createdAt: Date.now() - ageMs,
  });
}

async function callback(context: import('@playwright/test').BrowserContext, cookieValue: string, state: string) {
  const { hostname } = new URL(BASE_URL);
  await context.addCookies([
    { name: TX_COOKIE, value: cookieValue, domain: hostname, path: '/host' },
  ]);
  const page = await context.newPage();
  const chain: string[] = [];
  page.on('response', (r) => {
    if ([301, 302, 303, 307, 308].includes(r.status())) chain.push(r.url());
  });
  await page.goto(
    `/host/auth/google/callback?code=test-code-not-a-real-code&state=${encodeURIComponent(state)}`,
    { waitUntil: 'domcontentloaded' },
  );
  const cookies = await context.cookies();
  return { page, finalUrl: page.url(), chain, cookies };
}

test.describe('G6 Part B — expired transaction is refused safely', () => {
  test('an EXPIRED transaction is rejected and mints no Host session', async ({ context }) => {
    // 1ms past the bound — the smallest value that must already be refused.
    const { page, finalUrl, chain, cookies } = await callback(context, tx(TTL_MS + 1), 'state-under-test');

    // Refused with the honest notice.
    expect(finalUrl, 'must land on the root entry with the expired notice').toContain('notice=expired');

    // NO Host session was issued.
    expect(cookies.find((c) => c.name === HOST_COOKIE), 'no bty_host may be issued').toBeUndefined();

    // The one-time transaction was cleared, so it cannot be replayed.
    const leftover = cookies.find((c) => c.name === TX_COOKIE);
    expect(leftover?.value ?? '', 'transaction cookie must be cleared').toBe('');

    // No redirect loop: a single hop to the entry.
    expect(chain.length, `redirect chain: ${chain.join(' -> ')}`).toBeLessThanOrEqual(2);

    // Nothing sensitive is echoed into the URL or the rendered page.
    const html = await page.content();
    for (const secret of ['verifier-not-a-real-secret', 'nonce-not-a-real-secret', 'test-code-not-a-real-code', 'state-under-test']) {
      expect(finalUrl, `${secret} must not reach the URL`).not.toContain(secret);
      expect(html, `${secret} must not be rendered`).not.toContain(secret);
    }
    expect(html).not.toContain('client_secret');
  });

  test('a transaction just INSIDE the bound is not rejected as expired', async ({ context }) => {
    // Proves the expiry check is a real boundary, not a blanket refusal — otherwise
    // the test above would pass even if every attempt were rejected.
    const { finalUrl } = await callback(context, tx(TTL_MS - 5_000), 'state-under-test');
    expect(finalUrl, 'a fresh transaction must NOT be refused as expired').not.toContain('notice=expired');
    // It fails later (no real Google code), which is correct and still mints nothing.
    expect(finalUrl).toMatch(/notice=(exchange_failed|invalid_callback|verification_failed)/);
  });

  test('a STATE mismatch is refused and mints no session', async ({ context }) => {
    const { finalUrl, cookies } = await callback(context, tx(0, 'the-real-state'), 'a-different-state');
    expect(finalUrl).toContain('notice=state_mismatch');
    expect(cookies.find((c) => c.name === HOST_COOKIE)).toBeUndefined();
  });

  test('a MISSING transaction cookie is refused and mints no session', async ({ context }) => {
    const page = await context.newPage();
    await page.goto('/host/auth/google/callback?code=c&state=s', { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('notice=invalid_callback');
    expect((await context.cookies()).find((c) => c.name === HOST_COOKIE)).toBeUndefined();
  });

  test('after a refusal, a FRESH sign-in attempt can still be started', async ({ context }) => {
    await callback(context, tx(TTL_MS + 1), 'state-under-test');

    // Start a brand-new attempt: it must reach Google again with a NEW transaction.
    const page = await context.newPage();
    const res = await page.request.get('/host/auth/google', { maxRedirects: 0 });
    expect(res.status(), 'a new attempt must redirect to Google').toBe(307);
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('accounts.google.com');
    expect(location).toContain('code_challenge');

    const fresh = (await context.cookies()).find((c) => c.name === TX_COOKIE);
    expect(fresh?.value, 'a fresh transaction cookie must be issued').toBeTruthy();
    expect(fresh?.value, 'and it must not be the cleared one').not.toBe('');
  });
});
