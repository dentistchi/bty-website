import { describe, it, expect } from 'vitest';
import {
  PLAYER_COMMAND_TYPE,
  playerChannelName,
  playerWindowName,
  playerHref,
  buildPlayCommand,
  isPlayerPlayCommand,
} from './player-channel';

describe('player-channel — Room-scoped names', () => {
  it('channel and window names are stable and Room-scoped', () => {
    expect(playerChannelName('chi-norebang')).toBe('bty-norebang-player-chi-norebang');
    expect(playerWindowName('chi-norebang')).toBe('bty-norebang-player-chi-norebang');
    // different rooms → different channels (no cross-room leakage)
    expect(playerChannelName('a')).not.toBe(playerChannelName('b'));
  });

  it('playerHref is the same-origin Player route (encoded)', () => {
    expect(playerHref('chi-norebang')).toBe('/r/chi-norebang/player');
    expect(playerHref('a b')).toBe('/r/a%20b/player');
  });
});

describe('player-channel — buildPlayCommand', () => {
  it('builds a validated play command for a canonical 11-char id', () => {
    const cmd = buildPlayCommand('dQw4w9WgXcQ', 'req-1', 'evt-1');
    expect(cmd).toEqual({
      type: PLAYER_COMMAND_TYPE,
      command: 'play',
      videoId: 'dQw4w9WgXcQ',
      requestId: 'req-1',
      eventId: 'evt-1',
    });
  });

  it('returns null for a malformed video id (never emits an unvalidated command)', () => {
    expect(buildPlayCommand('', 'r', null)).toBeNull();
    expect(buildPlayCommand('short', 'r', null)).toBeNull();
    expect(buildPlayCommand('waytoolongforanid', 'r', null)).toBeNull();
    expect(buildPlayCommand('bad id!!!!!!', 'r', null)).toBeNull();
  });

  it('accepts a null eventId (unscoped nudge — the Player poll is the authority)', () => {
    expect(buildPlayCommand('dQw4w9WgXcQ', 'r', null)?.eventId).toBeNull();
  });
});

describe('player-channel — isPlayerPlayCommand (strict guard)', () => {
  const good = { type: PLAYER_COMMAND_TYPE, command: 'play', videoId: 'dQw4w9WgXcQ', requestId: 'r', eventId: null };

  it('accepts a well-formed command', () => {
    expect(isPlayerPlayCommand(good)).toBe(true);
    expect(isPlayerPlayCommand({ ...good, eventId: 'evt-1' })).toBe(true);
  });

  it('rejects wrong type / command', () => {
    expect(isPlayerPlayCommand({ ...good, type: 'other' })).toBe(false);
    expect(isPlayerPlayCommand({ ...good, command: 'stop' })).toBe(false);
  });

  it('rejects an invalid or non-string video id (no arbitrary payload acts on the Player)', () => {
    expect(isPlayerPlayCommand({ ...good, videoId: 'not-valid' })).toBe(false);
    expect(isPlayerPlayCommand({ ...good, videoId: 123 })).toBe(false);
    expect(isPlayerPlayCommand({ ...good, videoId: 'javascript:alert(1)' })).toBe(false);
  });

  it('rejects non-string requestId and malformed eventId', () => {
    expect(isPlayerPlayCommand({ ...good, requestId: 5 })).toBe(false);
    expect(isPlayerPlayCommand({ ...good, eventId: 5 })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isPlayerPlayCommand(null)).toBe(false);
    expect(isPlayerPlayCommand('play')).toBe(false);
    expect(isPlayerPlayCommand(undefined)).toBe(false);
  });
});
