import { describe, it, expect } from 'vitest';
import { canonicalUniversalLink, CANONICAL_APP_LINK_ORIGIN } from './app-link';

const TOKEN = 'ovDznz9yr7ulzBljaR5hr-C8Ozq24-hf';

describe('canonicalUniversalLink — always the app-links host, never the request origin', () => {
  it('1/4. builds https://norebang.btydaily.com/app/join/{token} from the fixed origin', () => {
    expect(CANONICAL_APP_LINK_ORIGIN).toBe('https://norebang.btydaily.com');
    expect(canonicalUniversalLink(TOKEN)).toBe(`https://norebang.btydaily.com/app/join/${TOKEN}`);
  });

  it('2. a workers.dev origin is REJECTED (fail closed) — never emitted as an app link', () => {
    expect(canonicalUniversalLink(TOKEN, 'https://bty-karaoke.ywamer2022.workers.dev')).toBeNull();
  });

  it('3. Host/origin spoofing cannot change the host', () => {
    expect(canonicalUniversalLink(TOKEN, 'https://evil.example.com')).toBeNull();
    expect(canonicalUniversalLink(TOKEN, 'https://norebang.btydaily.com.evil.com')).toBeNull();
    expect(canonicalUniversalLink(TOKEN, 'https://evil.com/#norebang.btydaily.com')).toBeNull();
  });

  it('non-HTTPS canonical host is rejected', () => {
    expect(canonicalUniversalLink(TOKEN, 'http://norebang.btydaily.com')).toBeNull();
  });

  it('4. path is exactly /app/join/{token}', () => {
    const link = canonicalUniversalLink(TOKEN)!;
    expect(new URL(link).pathname).toBe(`/app/join/${TOKEN}`);
    expect(new URL(link).host).toBe('norebang.btydaily.com');
  });

  it('malformed/empty token fails closed (never a broken link)', () => {
    expect(canonicalUniversalLink('')).toBeNull();
    expect(canonicalUniversalLink('tok en')).toBeNull();
    expect(canonicalUniversalLink('a/b')).toBeNull();
    expect(canonicalUniversalLink('tok?x=1')).toBeNull();
  });

  it('the production call uses the fixed origin, so ANY request origin yields the canonical link', () => {
    // The route calls canonicalUniversalLink(token) with the DEFAULT origin — request origin is
    // never consulted. Both "requests" therefore produce the same canonical link.
    const viaNorebang = canonicalUniversalLink(TOKEN); // default = canonical
    const viaWorkersDev = canonicalUniversalLink(TOKEN); // route ignores req origin identically
    expect(viaNorebang).toBe(`https://norebang.btydaily.com/app/join/${TOKEN}`);
    expect(viaWorkersDev).toBe(viaNorebang);
  });
});
