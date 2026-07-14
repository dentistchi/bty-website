import { describe, it, expect, vi } from 'vitest';
import { primaryPlayTarget, runPlayOnTv } from './play-flow';
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
  it('opens YouTube BEFORE running the play mutation', async () => {
    const calls: string[] = [];
    await runPlayOnTv({
      openVideo: () => calls.push('open'),
      play: async () => {
        calls.push('mutate');
      },
    });
    expect(calls).toEqual(['open', 'mutate']);
  });

  it('opens the video synchronously in the gesture, before the first await', () => {
    const openVideo = vi.fn();
    let mutationStarted = false;
    // Do not await — inspect state right after the synchronous prefix runs.
    void runPlayOnTv({
      openVideo,
      play: () => {
        mutationStarted = true;
      },
    });
    // window.open must already have fired inside the gesture...
    expect(openVideo).toHaveBeenCalledTimes(1);
    // ...but this synchronous check runs before the awaited mutation body.
    expect(mutationStarted).toBe(true);
  });

  it('still opened the video even if the mutation rejects (song stays waiting for retry)', async () => {
    const openVideo = vi.fn();
    await expect(
      runPlayOnTv({
        openVideo,
        play: async () => {
          throw new Error('server 409');
        },
      }),
    ).rejects.toThrow('server 409');
    expect(openVideo).toHaveBeenCalledTimes(1);
  });
});
