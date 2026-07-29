// BUILD 20B-WEB7-R1 — the conservative, display-only song-title projection.
// Provider noise is removed by an explicit ALLOWLIST; artist splits only when
// unambiguous; a karaoke company is never shown as the singer.

import { describe, it, expect } from 'vitest';
import { songDisplay } from './song-title';

describe('songDisplay — provider noise removal (allowlist)', () => {
  it('removes a TJ leading prefix and trailing brand, extracts Song/Artist + TJ source', () => {
    expect(songDisplay('[TJ노래방] 난 - 옥주현 / TJ Karaoke', 'TJ노래방 공식 유튜브채널')).toEqual({
      title: '난',
      artist: '옥주현',
      sourceLabel: 'TJ',
    });
  });

  it('removes a KY catalog code + KY trailing bracket + brand, extracts Song/Artist + KY source', () => {
    expect(songDisplay('난 - 조승구 (KY.86188) [KY 금영노래방] / KY Karaoke', 'KY Karaoke')).toEqual({
      title: '난',
      artist: '조승구',
      sourceLabel: 'KY',
    });
  });

  it('removes the "노래 / MR / 가사 / 반주" tail, keeps OST parenthetical, MR source', () => {
    const r = songDisplay('Test me(나의완벽한비서OST) - Paul Blanco 노래 / MR / 가사 / 반주', 'SomeChannel');
    expect(r.title).toBe('Test me (나의완벽한비서OST)');
    expect(r.artist).toBe('Paul Blanco');
    expect(r.sourceLabel).toBe('MR');
  });

  it('TJ example with a different artist', () => {
    expect(songDisplay('[TJ노래방] 난 - 클론 / TJ Karaoke', 'TJ노래방')).toEqual({
      title: '난',
      artist: '클론',
      sourceLabel: 'TJ',
    });
  });

  it('handles a spaced KY code form (KY 86188)', () => {
    const r = songDisplay('사랑 - 김범수 (KY 86188) [KY 금영노래방]', 'KY');
    expect(r.title).toBe('사랑');
    expect(r.artist).toBe('김범수');
    expect(r.sourceLabel).toBe('KY');
  });

  it('recognizes NWC and MR Live provider brackets', () => {
    expect(songDisplay('[NWC] 아무노래 - 지코', null).sourceLabel).toBe('NWC');
    expect(songDisplay('[MR Live] 밤편지 - 아이유', null).title).toBe('밤편지');
  });
});

describe('songDisplay — never invents / never provider-as-artist', () => {
  it('never shows a karaoke channel as the artist', () => {
    const r = songDisplay('좋은 날', 'TJ노래방 공식 유튜브채널');
    expect(r.title).toBe('좋은 날');
    expect(r.artist).toBeNull();
  });

  it('ambiguous multi-hyphen title falls back to the whole cleaned string (no false artist)', () => {
    const r = songDisplay('藤井風 - 何なんw 후지이 카제 - 뭐야ㅋ', null);
    expect(r.title).toBe('藤井風 - 何なんw 후지이 카제 - 뭐야ㅋ');
    expect(r.artist).toBeNull();
  });

  it('does not split when the right side is provider metadata', () => {
    const r = songDisplay('좋은 날 - TJ 노래방', null);
    expect(r.artist).toBeNull();
  });
});

describe('songDisplay — preserves meaningful text & languages', () => {
  it('preserves an OST parenthetical (never stripped as provider noise)', () => {
    const r = songDisplay('시작 (사내맞선 OST) - 가호', null);
    expect(r.title).toContain('사내맞선 OST');
    expect(r.artist).toBe('가호');
  });

  it('preserves a meaningful [Live] bracket (not a provider bracket)', () => {
    const r = songDisplay('밤편지 [Live]', '아이유');
    expect(r.title).toContain('[Live]');
  });

  it('a non-karaoke title is unchanged; a genuine channel becomes the artist', () => {
    expect(songDisplay('밤편지', '아이유')).toEqual({ title: '밤편지', artist: '아이유', sourceLabel: null });
  });

  it('preserves Korean / English / Japanese text', () => {
    expect(songDisplay('Dynamite', 'BTS').title).toBe('Dynamite');
    expect(songDisplay('何なんw', '藤井風').title).toBe('何なんw');
    expect(songDisplay('밤편지', '아이유').title).toBe('밤편지');
  });
});
