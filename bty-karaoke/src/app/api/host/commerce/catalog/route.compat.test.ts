// BUILD 26U-R4 §0 — COMMERCE-COMPAT-1…4: a legacy client must never be offered commerce.
//
// THE HAZARD. The public v1.0 binary (build 109) already ships a dormant commerce surface.
// Activating a catalog row for the v1.1 validation would otherwise populate it on a binary that
// was approved as FREE and has no Premium Room concept to explain the purchase with.
//
// The DB is deliberately stubbed with PASS_1H ACTIVE throughout this file — the whole point is
// that an ACTIVE product must still be invisible to a legacy caller.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  mode: 'dual' as 'legacy_free' | 'dual' | 'premium_all',
  /** The DB truth: PASS_1H is ACTIVE. Nothing below may leak it to a legacy client. */
  active: [
    { product_code: 'PASS_1H', storekit_product_id: 'com.btydaily.norebang.pass.1hour', pass_type: 'ONE_HOUR', duration_seconds: 3600 },
  ] as Record<string, unknown>[],
};

vi.mock('@/lib/host-auth.server', () => ({
  authorizeHost: vi.fn(async (t: string | null) => (t ? { id: 'acct-1' } : null)),
}));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));

vi.mock('@/lib/commerce-catalog.server', () => ({
  readActiveCommerceCatalog: vi.fn(async () =>
    state.active.map((r) => ({
      productId: r.storekit_product_id,
      productCode: r.product_code,
      passType: r.pass_type,
      durationSeconds: r.duration_seconds,
    })),
  ),
}));

vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: (name: string) =>
      name === 'karaoke_premium_room_mode'
        ? Promise.resolve({ data: state.mode, error: null })
        : Promise.resolve({ data: null, error: null }),
  }),
}));

import { GET } from './route';
import { readActiveCommerceCatalog } from '@/lib/commerce-catalog.server';

function req(client?: string): Parameters<typeof GET>[0] {
  const h = new Headers({ authorization: 'Bearer host-tok' });
  if (client) h.set('x-bty-client', client);
  return { headers: h } as unknown as Parameters<typeof GET>[0];
}
const body = async (r: Response) => r.json();

beforeEach(() => {
  state.mode = 'dual';
  state.active = [
    { product_code: 'PASS_1H', storekit_product_id: 'com.btydaily.norebang.pass.1hour', pass_type: 'ONE_HOUR', duration_seconds: 3600 },
  ];
  vi.clearAllMocks();
});

describe('COMMERCE-COMPAT-1 — a legacy client sees an EMPTY catalog even when the DB row is active', () => {
  it('build 109 (no header) under DUAL gets nothing, while PASS_1H is active in the DB', async () => {
    const b = await body(await GET(req()));
    expect(b.ok).toBe(true);
    expect(b.products).toEqual([]);
    expect(b.activeCount).toBe(0);
  });

  it('an old native build under DUAL gets nothing', async () => {
    const b = await body(await GET(req('native/109')));
    expect(b.products).toEqual([]);
    expect(b.activeCount).toBe(0);
  });

  it('a malformed / spoofed-nonsense identity gets nothing', async () => {
    for (const c of ['native/abc', 'ios/110', 'garbage', 'web', 'native/']) {
      const b = await body(await GET(req(c)));
      expect(b.products, `client "${c}"`).toEqual([]);
    }
  });

  it('the catalog is not even READ for a legacy caller — no DB round trip to leak', async () => {
    await GET(req());
    expect(readActiveCommerceCatalog).not.toHaveBeenCalled();
  });

  it('the empty shape is byte-identical to the "nothing active" shape build 109 already renders', async () => {
    // This is why no client change is needed: build 109 has always handled { products: [],
    // activeCount: 0 } as "not on sale", because that was the production state it shipped into.
    const legacy = await body(await GET(req()));
    state.active = [];
    const genuinelyEmpty = await body(await GET(req('native/110')));
    expect(legacy).toEqual(genuinelyEmpty);
  });
});

describe('COMMERCE-COMPAT-2 — a premium client sees the server-active product', () => {
  it('build 110 under DUAL gets PASS_1H', async () => {
    const b = await body(await GET(req('native/110')));
    expect(b.activeCount).toBe(1);
    expect(b.products[0].productCode).toBe('PASS_1H');
    expect(b.products[0].productId).toBe('com.btydaily.norebang.pass.1hour');
    expect(b.products[0].durationSeconds).toBe(3600);
  });

  it('web Host under DUAL is premium — no native-pays/web-free bypass', async () => {
    const b = await body(await GET(req('web/abc123')));
    expect(b.activeCount).toBe(1);
  });

  it('it still reflects the DB: an inactive catalog yields nothing even for build 110', async () => {
    state.active = [];
    const b = await body(await GET(req('native/110')));
    expect(b.products).toEqual([]);
    expect(b.activeCount).toBe(0);
  });
});

describe('COMMERCE-COMPAT-3 — a legacy client cannot authorize a purchase', () => {
  it('under LEGACY_FREE nobody sees commerce, whatever they claim to be', async () => {
    state.mode = 'legacy_free';
    for (const c of [undefined, 'native/109', 'native/110', 'web/abc']) {
      const b = await body(await GET(req(c)));
      expect(b.products, `client ${c}`).toEqual([]);
      expect(b.activeCount).toBe(0);
    }
  });

  it('an unsupported client (old build under PREMIUM_ALL) also sees nothing', async () => {
    state.mode = 'premium_all';
    const b = await body(await GET(req('native/109')));
    expect(b.products).toEqual([]);
  });

  it('an empty catalog IS the client-side refusal — asserted against the shipped native source', async () => {
    // `CommercePurchaseAuthority` requires the product to appear in THIS response AND in
    // StoreKit. An empty projection therefore makes purchase initiation unavailable with no
    // client change — which is what makes the containment work on an unmodifiable binary.
    const { readFileSync, existsSync } = await import('node:fs');
    const NATIVE = '/Users/hanbit/Dev/bty-norebang-admin-ios/BTYNorebangAdmin/Commerce.swift';
    if (!existsSync(NATIVE)) return; // native repo not checked out beside this one
    const src = readFileSync(NATIVE, 'utf8');
    // The gate consults the catalog state, and a not-loaded/empty catalog is a refusal.
    expect(src).toContain('catalogGate(');
    expect(src).toContain('catalog: CommerceCatalogState');
    // And a build with no purchase call compiled in refuses BEFORE any catalog fact is read —
    // which is why an `is_active` flip is already inert for a Release binary (BUILD 26T-R1B-R6).
    expect(src).toContain('ReleaseCommerceCapability.paidPurchaseCompiledIn');
    expect(src).toContain('.paidPassesNotInThisBuild');
  });
});

describe('COMMERCE-COMPAT-4 — settlement never depends on this projection', () => {
  it('the verify route does not consult the release contract or the catalog', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(
      fileURLToPath(new URL('../../purchases/apple/verify/route.ts', import.meta.url)),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toContain('resolveRelease');
    expect(src).not.toContain('readActiveCommerceCatalog');
    expect(src).not.toContain('x-bty-client');
  });

  it('the fulfil route does not consult the release contract or the catalog', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(
      fileURLToPath(new URL('../../purchases/apple/fulfil/route.ts', import.meta.url)),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toContain('resolveRelease');
    expect(src).not.toContain('readActiveCommerceCatalog');
    expect(src).not.toContain('x-bty-client');
  });

  // A customer's money moved. A DISPLAY rule must never be able to strand a purchase they
  // legitimately made — that is why the projection lives only on the read surface.
});
