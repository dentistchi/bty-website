import { describe, it, expect } from 'vitest';
import { resolveHostEntry } from './host-entry';

describe('resolveHostEntry', () => {
  it('signed out → Google entry, regardless of rooms', () => {
    expect(resolveHostEntry({ authenticated: false, roomSlugs: [] })).toEqual({ kind: 'signed_out' });
    expect(resolveHostEntry({ authenticated: false, roomSlugs: ['a', 'b'] })).toEqual({ kind: 'signed_out' });
  });

  it('zero rooms → the honest empty state (never auto-creates)', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: [] })).toEqual({ kind: 'empty' });
    expect(resolveHostEntry({ authenticated: true, roomSlugs: [], explicitHub: true })).toEqual({ kind: 'empty' });
  });

  it('one room, normal entry → auto-enter (fast path preserved, any plan)', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['bty-home'] })).toEqual({
      kind: 'auto_enter',
      slug: 'bty-home',
    });
  });

  it('one room, EXPLICIT hub → chooser (Host asked for My Norebang, so can add another)', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['bty-home'], explicitHub: true })).toEqual({
      kind: 'chooser',
    });
  });

  it('two or more rooms → chooser (explicit or not)', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['a', 'b'] })).toEqual({ kind: 'chooser' });
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['a', 'b', 'c'], explicitHub: true })).toEqual({ kind: 'chooser' });
  });
});
