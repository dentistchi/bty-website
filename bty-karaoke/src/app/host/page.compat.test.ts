// /host is a compatibility shim for the single-URL entry: it must redirect to the
// canonical root `/` (never render its own screen, never loop). Redirect is mocked
// so the call is observable instead of throwing.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectSpy = vi.fn();
vi.mock('next/navigation', () => ({ redirect: (u: string) => redirectSpy(u) }));

import HostPage from './page';

beforeEach(() => redirectSpy.mockClear());

describe('/host compatibility', () => {
  it('redirects to the canonical root', async () => {
    await HostPage({ searchParams: Promise.resolve({}) });
    expect(redirectSpy).toHaveBeenCalledWith('/');
  });

  it('preserves a notice when redirecting', async () => {
    await HostPage({ searchParams: Promise.resolve({ notice: 'signed_out' }) });
    expect(redirectSpy).toHaveBeenCalledWith('/?notice=signed_out');
  });
});
