import { describe, it, expect } from 'vitest';
import { classifyVideo, badgeForKind, badgeForVideo } from './video-kind';

describe('classifyVideo', () => {
  it('detects karaoke / 노래방', () => {
    expect(classifyVideo('Dancing Queen (Karaoke Version)')).toBe('karaoke');
    expect(classifyVideo('아이유 - 좋은날 노래방')).toBe('karaoke');
  });

  it('detects MR / instrumental as its own family', () => {
    expect(classifyVideo('Bohemian Rhapsody Instrumental')).toBe('mr');
    expect(classifyVideo('밤편지 MR')).toBe('mr');
    expect(classifyVideo('Someone Like You (Backing Track)')).toBe('mr');
    expect(classifyVideo('좋은날 반주')).toBe('mr');
  });

  it('a karaoke provider / 노래방 tag wins over a bare "MR" token (V5.2)', () => {
    // A TJ / 금영 / 노래방 "MR" is the sing-along karaoke version → karaoke.
    expect(classifyVideo('좋은날 노래방 MR')).toBe('karaoke');
    expect(classifyVideo('이별 MR 노래방 TJ')).toBe('karaoke');
    expect(classifyVideo('사랑했지만', '금영노래방')).toBe('karaoke');
  });

  it('but clear instrumental evidence stays MR even with a "karaoke" word', () => {
    expect(classifyVideo('이별 MR instrumental')).toBe('mr');
    expect(classifyVideo('좋은날 karaoke instrumental')).toBe('mr');
    expect(classifyVideo('밤편지 MR')).toBe('mr'); // bare MR, no karaoke signal
    expect(classifyVideo('좋은날 반주')).toBe('mr');
  });

  it('detects lyrics / 가사 / 자막 videos', () => {
    expect(classifyVideo('Adele - Hello (Lyrics)')).toBe('lyrics');
    expect(classifyVideo('아이유 좋은날 가사')).toBe('lyrics');
  });

  it('karaoke wins over lyrics when both present', () => {
    expect(classifyVideo('좋은날 노래방 가사')).toBe('karaoke');
  });

  it('detects official music videos / VEVO', () => {
    expect(classifyVideo('Taylor Swift - Blank Space', 'TaylorSwiftVEVO')).toBe('mv');
    expect(classifyVideo('BTS (방탄소년단) Official MV')).toBe('mv');
  });

  it('detects official audio / topic channels', () => {
    expect(classifyVideo('Blank Space (Official Audio)')).toBe('official');
    expect(classifyVideo('Blank Space', 'Taylor Swift - Topic')).toBe('official');
  });

  it('stays unknown when there is no clear signal', () => {
    expect(classifyVideo('Dancing Queen', 'Some Random Channel')).toBe('unknown');
    expect(classifyVideo('', '')).toBe('unknown');
  });
});

describe('badgeForKind / badgeForVideo', () => {
  it('gives a badge for confident kinds', () => {
    expect(badgeForKind('mr')?.tone).toBe('mr');
    expect(badgeForKind('mr')?.emoji).toBe('🎹');
    expect(badgeForKind('karaoke')?.tone).toBe('karaoke');
    expect(badgeForKind('lyrics')?.label).toBe('Lyrics');
    expect(badgeForKind('mv')?.emoji).toBe('🎬');
  });

  it('gives NO badge for unknown (never claims what it cannot see)', () => {
    expect(badgeForKind('unknown')).toBeNull();
    expect(badgeForVideo('Dancing Queen', 'Random')).toBeNull();
  });

  it('badgeForVideo classifies then badges', () => {
    expect(badgeForVideo('좋은날 노래방')?.tone).toBe('karaoke');
  });
});
