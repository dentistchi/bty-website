import { describe, it, expect } from 'vitest';
import { resolveHostEntry } from './host-entry';

describe('resolveHostEntry', () => {
  it('signed out → Google entry, regardless of room list or plan', () => {
    expect(resolveHostEntry({ authenticated: false, roomSlugs: [], plan: 'FREE' })).toEqual({ kind: 'signed_out' });
    expect(resolveHostEntry({ authenticated: false, roomSlugs: ['bty-home'], plan: 'PRO' })).toEqual({ kind: 'signed_out' });
    expect(resolveHostEntry({ authenticated: false, roomSlugs: ['a', 'b'], plan: 'FREE' })).toEqual({ kind: 'signed_out' });
  });

  it('signed in with zero rooms → the honest empty state (never auto-creates), any plan', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: [], plan: 'FREE' })).toEqual({ kind: 'empty' });
    expect(resolveHostEntry({ authenticated: true, roomSlugs: [], plan: 'PRO' })).toEqual({ kind: 'empty' });
  });

  it('one room + FREE → auto-enter (shipped fast path preserved)', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['bty-home'], plan: 'FREE' })).toEqual({
      kind: 'auto_enter',
      slug: 'bty-home',
    });
  });

  it('one room + PRO → chooser (so a PRO Host can reach "create another")', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['bty-home'], plan: 'PRO' })).toEqual({ kind: 'chooser' });
  });

  it('two or more rooms → chooser, any plan (incl. legacy FREE multi-room)', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['a', 'b'], plan: 'FREE' })).toEqual({ kind: 'chooser' });
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['a', 'b'], plan: 'PRO' })).toEqual({ kind: 'chooser' });
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['a', 'b', 'c'], plan: 'PRO' })).toEqual({ kind: 'chooser' });
  });
});
