// GET /api/host/commerce/catalog — BUILD 26T-R1A pre-purchase read.
//
// The property that matters is that this endpoint can only ever UNDER-report what is sellable.
// It filters on is_active, never echoes it, and never writes — so the failure mode it must not
// have is "returned a product the server would refuse at /verify", which is how a customer gets
// charged for something we cannot deliver.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const state = {
  account: { id: 'acct-1' } as { id: string } | null,
  products: [] as unknown[],
};

vi.mock('@/lib/dj-auth.server', () => ({ bearerFromHeader: () => 'tok' }));
vi.mock('@/lib/host-web-session.server', () => ({ hostTokenFromRequest: () => null }));
vi.mock('@/lib/host-auth.server', () => ({ authorizeHost: async () => state.account }));

const readActiveCommerceCatalog = vi.fn(async () => state.products);
vi.mock('@/lib/commerce-catalog.server', () => ({
  readActiveCommerceCatalog: () => readActiveCommerceCatalog(),
}));

// BUILD 26U-R4 §0 — the route now projects through the release contract before reading the DB.
// This file's subject is the CONTRACT SHAPE of the response for a client that may see commerce,
// so the mode is DUAL and the requests below identify as a premium-capable client. The legacy
// projection has its own file (route.compat.test.ts), where an ACTIVE product must stay hidden.
vi.mock('@/lib/supabase.server', () => ({
  karaokeDb: () => ({
    rpc: (name: string) =>
      name === 'karaoke_premium_room_mode'
        ? Promise.resolve({ data: 'dual', error: null })
        : Promise.resolve({ data: null, error: null }),
  }),
}));

import { GET } from './route';

const PASS_1H = {
  productId: 'com.btydaily.norebang.pass.1hour',
  productCode: 'PASS_1H',
  passType: 'ONE_HOUR',
  durationSeconds: 3600,
};

// Identifies as a premium-capable client (build 110), so this file measures the response shape
// a client that MAY see commerce receives. A caller with no identity is a legacy caller and is
// covered by route.compat.test.ts.
const req = () =>
  new NextRequest('https://x/api/host/commerce/catalog', {
    headers: { 'x-bty-client': 'native/110' },
  });

beforeEach(() => {
  state.account = { id: 'acct-1' };
  state.products = [];
  readActiveCommerceCatalog.mockClear();
});

describe('GET /api/host/commerce/catalog', () => {
  it('refuses without a host session, and reads nothing', async () => {
    state.account = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    // A public description of our commerce posture is not on offer, and an unauthenticated
    // request must not even reach the database.
    expect(readActiveCommerceCatalog).not.toHaveBeenCalled();
  });

  it('reports the truthful empty answer while every product is inactive', async () => {
    // The BUILD 26T-R0 production state: 3 catalog rows, 0 active.
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, products: [], activeCount: 0 });
  });

  it('returns an activated product with its contract facts', async () => {
    state.products = [PASS_1H];
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.activeCount).toBe(1);
    expect(body.products).toEqual([PASS_1H]);
  });

  it('never discloses is_active, prices, account data or financial rows', async () => {
    state.products = [PASS_1H];
    const body = await (await GET(req())).json();
    const serialized = JSON.stringify(body);
    for (const forbidden of ['is_active', 'isActive', 'price', 'account', 'grant', 'purchase']) {
      expect(serialized).not.toContain(forbidden);
    }
    // Exactly the four contract fields — a widened shape is a disclosure decision, not an accident.
    expect(Object.keys(body.products[0]).sort()).toEqual([
      'durationSeconds',
      'passType',
      'productCode',
      'productId',
    ]);
  });

  it('is not cacheable — a stale "we are selling" answer is the dangerous one', async () => {
    const res = await GET(req());
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('does not vary by account — activation is a property of the product', async () => {
    state.products = [PASS_1H];
    const first = await (await GET(req())).json();
    state.account = { id: 'acct-2' };
    const second = await (await GET(req())).json();
    expect(second).toEqual(first);
  });
});
