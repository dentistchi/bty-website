import { describe, it, expect } from 'vitest';
import { resolveHostEntry } from './host-entry';

describe('resolveHostEntry', () => {
  it('signed out → Google entry, regardless of room list', () => {
    expect(resolveHostEntry({ authenticated: false, roomSlugs: [] })).toEqual({ kind: 'signed_out' });
    expect(resolveHostEntry({ authenticated: false, roomSlugs: ['bty-home'] })).toEqual({ kind: 'signed_out' });
    expect(resolveHostEntry({ authenticated: false, roomSlugs: ['a', 'b'] })).toEqual({ kind: 'signed_out' });
  });

  it('signed in with exactly one room → auto-enter that room', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['bty-home'] })).toEqual({
      kind: 'auto_enter',
      slug: 'bty-home',
    });
  });

  it('signed in with two or more rooms → the My Norebang chooser', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['a', 'b'] })).toEqual({ kind: 'chooser' });
    expect(resolveHostEntry({ authenticated: true, roomSlugs: ['a', 'b', 'c'] })).toEqual({ kind: 'chooser' });
  });

  it('signed in with zero rooms → the honest empty state (never auto-creates)', () => {
    expect(resolveHostEntry({ authenticated: true, roomSlugs: [] })).toEqual({ kind: 'empty' });
  });
});
