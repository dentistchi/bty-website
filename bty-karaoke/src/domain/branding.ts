// Room Branding V1 — the fixed visual-theme allowlist. Pure; no I/O.
//
// The theme is ALWAYS one of these three server-controlled identifiers. The UI maps
// it to a CSS class (`theme-<id>`); raw colors / CSS / hex are never accepted from a
// client. 'midnight_gold' is the current :root look, so it is the default and keeps
// every existing Room (bty-home) visually unchanged.

export const BRANDING_THEMES = ['midnight_gold', 'neon_night', 'warm_stage'] as const;
export type BrandingTheme = (typeof BRANDING_THEMES)[number];
export const DEFAULT_THEME: BrandingTheme = 'midnight_gold';

export function isBrandingTheme(v: unknown): v is BrandingTheme {
  return typeof v === 'string' && (BRANDING_THEMES as readonly string[]).includes(v);
}

/** Coerce any input to a valid theme, falling back to the default. Never throws. */
export function normalizeTheme(v: unknown): BrandingTheme {
  return isBrandingTheme(v) ? v : DEFAULT_THEME;
}

/** Human labels for the three theme cards (Korean UI). */
export const THEME_META: Record<BrandingTheme, { label: string; hint: string }> = {
  midnight_gold: { label: '미드나잇 골드', hint: '깊은 네이비 + 골드 (기본)' },
  neon_night: { label: '네온 나이트', hint: '어두운 배경 + 보라·시안' },
  warm_stage: { label: '웜 스테이지', hint: '따뜻한 배경 + 앰버·코랄' },
};
