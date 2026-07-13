// User-facing product identity. Single source of truth for the brand name so
// no surface can drift back to "Karaoke"/"Chi Karaoke". "karaoke" may still be
// used technically (YouTube search bias, legacy schema) but never as the name.

export const PRODUCT_NAME = 'btyNorebang';
export const PRODUCT_TAGLINE_KO = '함께 부르는 오늘의 노래';
export const PRODUCT_TAGLINE_EN = 'Sing together.';
export const PRODUCT_DESCRIPTION = `${PRODUCT_NAME} — ${PRODUCT_TAGLINE_KO}`;
