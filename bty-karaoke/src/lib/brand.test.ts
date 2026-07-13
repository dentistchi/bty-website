import { describe, expect, it } from 'vitest';
import { PRODUCT_NAME, PRODUCT_TAGLINE_KO, PRODUCT_DESCRIPTION } from './brand';

describe('brand lock', () => {
  it('user-facing product name is exactly btyNorebang', () => {
    expect(PRODUCT_NAME).toBe('btyNorebang');
  });

  it('never uses "karaoke" or "chi" as the product name', () => {
    expect(PRODUCT_NAME.toLowerCase()).not.toContain('karaoke');
    expect(PRODUCT_NAME.toLowerCase()).not.toContain('chi');
  });

  it('ships a warm Korean-first tagline', () => {
    expect(PRODUCT_TAGLINE_KO).toBe('함께 부르는 오늘의 노래');
    expect(PRODUCT_DESCRIPTION.startsWith('btyNorebang')).toBe(true);
  });
});
