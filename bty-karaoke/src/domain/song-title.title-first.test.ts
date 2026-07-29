// BUILD 20B-WEB7-R2 — PRODUCTION TITLE-FIRST GUARANTEE.
//
// Reproduces the EXACT titles/channels captured live from norebang.btydaily.com
// (query "옥주현 난" / "임재범 너를위해") and pins the hard product rule: the display
// title may NEVER begin with provider text (TJ/KY/MR/NWC/노래방/금영/Karaoke).

import { describe, it, expect } from 'vitest';
import { songDisplay } from './song-title';

// Tokens a title's first visible character must never start with (hard rule §2).
const FORBIDDEN_PREFIX = /^(?:TJ|KY|MR|NWC|금영|노래방|가라오케|karaoke)\b/i;

/** Shared guard so a new surface/case cannot regress into a provider-first title. */
export function assertTitleFirst(rawTitle: string, channel: string | null) {
  const { title } = songDisplay(rawTitle, channel);
  expect(title.length).toBeGreaterThan(0);
  expect(FORBIDDEN_PREFIX.test(title)).toBe(false);
  return title;
}

// The EXACT live rows captured in production (see report §1/§2).
const LIVE: Array<{ raw: string; channel: string }> = [
  { raw: 'MR 노래방ㆍkaraoke] 난 - 옥주현 ㆍTroublousness - Oak Joo-hyun', channel: 'MR 노래방 l MR karaoke' },
  { raw: '[TJ노래방] 난 - 옥주현 / TJ Karaoke', channel: 'TJ노래방 공식 유튜브채널' },
  { raw: '난...- 옥주현 (KY.9423) [KY 금영노래방] / KY Karaoke', channel: '금영 노래방 공식 유튜브 채널' },
  { raw: '[JW노래방] 난 / 옥주현 / JW Karaoke', channel: 'JWPlay 노래방' },
  { raw: '[TJ노래방 / 멜로디제거] 너를위해 - 임재범 / TJ Karaoke', channel: 'TJ노래방 공식 유튜브채널' },
];

describe('production title-first guarantee', () => {
  it('the EXACT failing live row no longer renders provider-first (1, 2, 3)', () => {
    const { title, artist } = songDisplay(LIVE[0].raw, LIVE[0].channel);
    // Before the fix this returned the raw string starting with "MR 노래방…".
    expect(title.startsWith('MR')).toBe(false);
    expect(title.startsWith('난')).toBe(true);
    // A karaoke-company channel is never surfaced as the artist (§5).
    expect(artist ?? '').not.toMatch(/노래방|karaoke/i);
  });

  it('every live row is title-first (4, 7–10 via the shared surfaces)', () => {
    for (const row of LIVE) assertTitleFirst(row.raw, row.channel);
  });

  it('the classic TJ row still extracts 난 / 옥주현 / TJ', () => {
    expect(songDisplay(LIVE[1].raw, LIVE[1].channel)).toEqual({ title: '난', artist: '옥주현', sourceLabel: 'TJ' });
  });

  it('strips a "/ <name> Karaoke" trailing segment (JW variant), keeping the title', () => {
    const { title } = songDisplay(LIVE[3].raw, LIVE[3].channel);
    expect(title.startsWith('난')).toBe(true);
    expect(title).not.toMatch(/karaoke/i);
  });
});

describe('title-first is robust, not over-broad (11, 6)', () => {
  it('a dangling provider fragment "…]" with no opening bracket is stripped', () => {
    expect(songDisplay('TJ 노래방] 사랑 - 김범수', null).title).toBe('사랑');
  });

  it('never strips a real word that merely starts with MR/TJ (".": not a separator)', () => {
    expect(songDisplay('Mr. Simple - Super Junior', 'SM').title).toBe('Mr. Simple');
    expect(songDisplay('MRI - Some Band', 'X').title).toBe('MRI');
  });

  it('ambiguous multi-hyphen title stays intact (no false artist)', () => {
    const r = songDisplay('藤井風 - 何なんw 후지이 카제 - 뭐야ㅋ', null);
    expect(r.title).toBe('藤井風 - 何なんw 후지이 카제 - 뭐야ㅋ');
    expect(r.artist).toBeNull();
  });

  it('a plain non-karaoke title is unchanged', () => {
    expect(songDisplay('밤편지', '아이유')).toEqual({ title: '밤편지', artist: '아이유', sourceLabel: null });
  });
});
