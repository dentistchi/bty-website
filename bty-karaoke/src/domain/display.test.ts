import { describe, it, expect } from 'vitest';
import { displayEmbedUrl } from './display';

describe('displayEmbedUrl', () => {
  it('builds a muted, privacy-friendly nocookie embed for a valid id', () => {
    const url = displayEmbedUrl('dQw4w9WgXcQ');
    expect(url).not.toBeNull();
    expect(url!).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(url!).toContain('mute=1'); // sound lives on the TV, not the iPad
    expect(url!).toContain('playsinline=1');
    expect(url!).toContain('autoplay=1');
  });

  it('returns null for a malformed id (never a bare iframe target)', () => {
    expect(displayEmbedUrl('')).toBeNull();
    expect(displayEmbedUrl(null)).toBeNull();
    expect(displayEmbedUrl('not an id')).toBeNull();
    expect(displayEmbedUrl('javascript:alert(1)')).toBeNull();
    expect(displayEmbedUrl('short')).toBeNull();
  });
});
