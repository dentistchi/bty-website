import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as display from './display';

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
