// BUILD 20B-WEB7-R3 — bilingual duplicate title collapse. A Korean/CJK ↔ Latin
// DUPLICATE of one "Song - Artist" pair (joined by ㆍ/·) collapses to its Korean
// half; collaborations, medleys, version suffixes, and ambiguous titles never do.

import { describe, it, expect } from 'vitest';
import { songDisplay } from './song-title';

const EXACT = 'MR 노래방ㆍkaraoke] 난 - 옥주현 ㆍTroublousness - Oak Joo-hyun';

describe('R3 collapse — the exact production case (1, 2)', () => {
  it('the exact live MR title → 난 / 옥주현 / MR', () => {
    expect(songDisplay(EXACT, 'MR 노래방 l MR karaoke')).toEqual({ title: '난', artist: '옥주현', sourceLabel: 'MR' });
  });

  it('the raw title string is not mutated by formatting (display-only)', () => {
    const raw = EXACT;
    songDisplay(raw, 'MR 노래방 l MR karaoke');
    expect(raw).toBe('MR 노래방ㆍkaraoke] 난 - 옥주현 ㆍTroublousness - Oak Joo-hyun');
  });
});

describe('R3 collapse — script selection (3, 4)', () => {
  it('Korean-left + English-right duplicate collapses to Korean', () => {
    expect(songDisplay('난 - 옥주현 ㆍ Troublousness - Oak Joo-hyun', null)).toMatchObject({ title: '난', artist: '옥주현' });
  });

  it('English-left + Korean-right duplicate still selects the Korean half', () => {
    expect(songDisplay('Troublousness - Oak Joo-hyun ㆍ 난 - 옥주현', null)).toMatchObject({ title: '난', artist: '옥주현' });
  });
});

describe('R3 — never collapses without strong duplicate evidence (5–9)', () => {
  it('a meaningful Live suffix is preserved (not collapsed away)', () => {
    const { title } = songDisplay('사랑 - 김범수 ㆍ Love - Kim Bum Soo Live', null);
    expect(title).toContain('Live');
  });

  it('a meaningful OST suffix is preserved', () => {
    expect(songDisplay('시작 (사내맞선 OST) - 가호', null).title).toContain('OST');
    // A bilingual pair where one half carries OST must NOT be collapsed away.
    expect(songDisplay('시작 OST - 가호 ㆍ Start - Gaho', null).title).toContain('OST');
  });

  it('an artist collaboration using · is not cut into a false single artist', () => {
    // Same-script sides → not a bilingual duplicate; the · stays in the title.
    expect(songDisplay('옥주현 · 아이유 - 좋은날', null).title).toContain('·');
  });

  it('a medley using · is not collapsed', () => {
    expect(songDisplay('Part 1 · Part 2', null).title).toBe('Part 1 · Part 2');
  });

  it('the ambiguous multi-hyphen Fujii Kaze title (no bilingual sep) stays intact', () => {
    const r = songDisplay('藤井風 - 何なんw 후지이 카제 - 뭐야ㅋ', null);
    expect(r.title).toBe('藤井風 - 何なんw 후지이 카제 - 뭐야ㅋ');
    expect(r.artist).toBeNull();
  });
});

describe('R3 — plain titles + provider suppression (10, 11, 12)', () => {
  it('a plain Korean title is unchanged', () => {
    expect(songDisplay('밤편지', '아이유')).toEqual({ title: '밤편지', artist: '아이유', sourceLabel: null });
  });

  it('a plain English title is unchanged', () => {
    expect(songDisplay('Dynamite', 'BTS')).toEqual({ title: 'Dynamite', artist: 'BTS', sourceLabel: null });
  });

  it('a karaoke-company channel is still never shown as the artist', () => {
    expect(songDisplay(EXACT, 'MR 노래방 l MR karaoke').artist).toBe('옥주현'); // from the title, not the channel
    expect(songDisplay('좋은 날', 'TJ노래방 공식 유튜브채널').artist).toBeNull();
  });
});
