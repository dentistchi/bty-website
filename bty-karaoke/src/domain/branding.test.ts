import { describe, it, expect } from 'vitest';
import { BRANDING_THEMES, DEFAULT_THEME, isBrandingTheme, normalizeTheme } from './branding';

describe('branding themes', () => {
  it('exposes exactly the three allowlisted themes; default is midnight_gold', () => {
    expect(BRANDING_THEMES).toEqual(['midnight_gold', 'neon_night', 'warm_stage']);
    expect(DEFAULT_THEME).toBe('midnight_gold');
  });

  it('isBrandingTheme accepts only allowlisted ids', () => {
    expect(isBrandingTheme('neon_night')).toBe(true);
    expect(isBrandingTheme('warm_stage')).toBe(true);
    expect(isBrandingTheme('midnight_gold')).toBe(true);
    expect(isBrandingTheme('rainbow')).toBe(false);
    expect(isBrandingTheme('')).toBe(false);
    expect(isBrandingTheme(null)).toBe(false);
    expect(isBrandingTheme(123)).toBe(false);
  });

  it('normalizeTheme coerces any unknown / injected value to the default (no raw CSS/colors)', () => {
    expect(normalizeTheme('neon_night')).toBe('neon_night');
    expect(normalizeTheme('warm_stage')).toBe('warm_stage');
    expect(normalizeTheme('unknown')).toBe('midnight_gold');
    expect(normalizeTheme('#ff0000')).toBe('midnight_gold');
    expect(normalizeTheme('red; background: url(evil)')).toBe('midnight_gold');
    expect(normalizeTheme('<script>')).toBe('midnight_gold');
    expect(normalizeTheme(undefined)).toBe('midnight_gold');
    expect(normalizeTheme(null)).toBe('midnight_gold');
  });
});
