/** The six widths BUILD 26B is contracted to support. */
export const WIDTHS = [
  { w: 1440, h: 900, label: '1440-desktop' },
  { w: 1024, h: 768, label: '1024-tablet-landscape' },
  { w: 768, h: 1024, label: '768-tablet-portrait' },
  { w: 430, h: 932, label: '430-mobile' },
  { w: 390, h: 844, label: '390-mobile' },
  { w: 360, h: 800, label: '360-narrow' },
] as const;

/** The touch-target contract: 44 x 44 CSS pixels. */
export const MIN_TAP = 44;
