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

  it('MR wins over karaoke when both terms appear', () => {
    // A "karaoke MR" clip is the vocals-removed one — MR is the stronger signal.
    expect(classifyVideo('좋은날 노래방 MR')).toBe('mr');
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
