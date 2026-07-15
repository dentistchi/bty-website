import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as display from './display';
import { displayStatsFrom } from './display';

// V3.1: the iPad Display is not a video player. The read-model module must not
// ship an embed-URL helper (removed to stop "Video unavailable" on embed-blocked
// karaoke uploads). These guards keep it that way.
describe('domain/display — no embed URL generation', () => {
  it('exports no embed/player helper', () => {
    expect((display as Record<string, unknown>).displayEmbedUrl).toBeUndefined();
    const exported = Object.keys(display);
    expect(exported.some((k) => /embed|iframe|player/i.test(k))).toBe(false);
  });

  it('source references no youtube-nocookie / iframe / embed URL builder', () => {
    const src = readFileSync(fileURLToPath(new URL('./display.ts', import.meta.url)), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/youtube-nocookie/);
    expect(code).not.toMatch(/\/embed\//);
    expect(code).not.toMatch(/autoplay/);
  });
});

describe('displayStatsFrom — LIVE panel counts (V4)', () => {
  it('counts distinct singers, total requests, completed, and waiting', () => {
    const stats = displayStatsFrom([
      { guest_name: 'Han', status: 'completed' },
      { guest_name: 'han', status: 'waiting' }, // same singer, case-insensitive
      { guest_name: 'Bo', status: 'playing' },
      { guest_name: 'Cho', status: 'waiting' },
      { guest_name: 'Deb', status: 'removed' }, // counts toward singers/requests only
    ]);
    expect(stats).toEqual({ singers: 4, requests: 5, completed: 1, waiting: 2 });
  });

  it('is all-zero for an empty room', () => {
    expect(displayStatsFrom([])).toEqual({ singers: 0, requests: 0, completed: 0, waiting: 0 });
  });
});
