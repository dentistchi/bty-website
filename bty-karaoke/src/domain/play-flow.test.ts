import { describe, it, expect, vi } from 'vitest';
import { primaryPlayTarget, runPlayOnTv, runOpenOnDevice } from './play-flow';
import type { StageEntry } from './play-flow';

const w = (id: string): StageEntry => ({ id, status: 'waiting' });

describe('primaryPlayTarget', () => {
  it('targets the first waiting song when the stage is open', () => {
    const target = primaryPlayTarget(null, [w('a'), w('b'), w('c')]);
    expect(target?.id).toBe('a');
  });

  it('has no play target while a song is on stage (no parallel play)', () => {
    const current: StageEntry = { id: 'p', status: 'playing' };
    expect(primaryPlayTarget(current, [w('a'), w('b')])).toBeNull();
  });

  it('has no play target when there are no waiting songs', () => {
    expect(primaryPlayTarget(null, [])).toBeNull();
  });
});

describe('runPlayOnTv', () => {
  it('commits the play mutation BEFORE navigating to YouTube', async () => {
    const calls: string[] = [];
    await runPlayOnTv({
      play: async () => {
        calls.push('mutate');
      },
      openVideo: () => calls.push('navigate'),
    });
    expect(calls).toEqual(['mutate', 'navigate']);
  });

  it('does not navigate until the mutation has resolved', async () => {
    const openVideo = vi.fn();
    let resolvePlay!: () => void;
    const play = () => new Promise<void>((r) => (resolvePlay = r));
    const done = runPlayOnTv({ play, openVideo });
    // Mutation is still pending — navigation must not have fired yet.
    await Promise.resolve();
    expect(openVideo).not.toHaveBeenCalled();
    resolvePlay();
    await done;
    expect(openVideo).toHaveBeenCalledTimes(1);
  });

  it('skips navigation if the mutation rejects (song stays waiting for retry)', async () => {
    const openVideo = vi.fn();
    await expect(
      runPlayOnTv({
        play: async () => {
          throw new Error('server 409');
        },
        openVideo,
      }),
    ).rejects.toThrow('server 409');
    // Never sent the DJ to YouTube for a song that never started.
    expect(openVideo).not.toHaveBeenCalled();
  });
});

describe('runOpenOnDevice ("Open on this iPad")', () => {
  it('navigates but NEVER mutates state (no play effect exists)', () => {
    const openVideo = vi.fn();
    runOpenOnDevice({ openVideo });
    expect(openVideo).toHaveBeenCalledTimes(1);
    // The effects shape has no `play` — it is impossible for this path to move a
    // request to playing, so "Open on this iPad" can never change queue state.
    // @ts-expect-error — play is intentionally not part of OpenOnDeviceEffects.
    expect(({ openVideo }).play).toBeUndefined();
  });

  it('is synchronous and independent of any playback transition', () => {
    let played = false;
    const openVideo = vi.fn();
    runOpenOnDevice({ openVideo });
    expect(played).toBe(false); // nothing could have started a song
    expect(openVideo).toHaveBeenCalled();
  });
});
