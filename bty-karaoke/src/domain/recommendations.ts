// Pure recommendation seeding. Turns a chosen song into ordered candidate SEARCH
// QUERIES — same-artist first, then a mood/genre seed. The server resolves each
// query through the existing YouTube search path so every recommendation is a
// REAL video (never a fabricated id). No network here.

export interface RecoSource {
  title: string;
  channelTitle: string;
}

const ARTIST_NOISE = /vevo|-\s*topic|official|\bTV\b|records|entertainment|채널|music|뮤직/gi;

/** Best-effort artist name from a result: "Artist - Song" title, else channel. */
export function parseArtist(source: RecoSource): string {
  const sep = source.title.match(/^\s*(.{1,40}?)\s*[-_–—]\s+.+/);
  const raw = sep ? sep[1] : source.channelTitle;
  return raw
    .replace(ARTIST_NOISE, ' ')
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title with bracketed tags and the artist prefix stripped, for a mood seed. */
export function coreTitle(source: RecoSource, artist: string): string {
  let t = source.title.replace(/\[[^\]]*\]|\([^)]*\)/g, ' ');
  if (artist) t = t.replace(new RegExp(`^\\s*${escapeRe(artist)}\\s*[-_–—]?\\s*`, 'i'), '');
  return t.replace(/\s+/g, ' ').trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const MAX_RECOMMENDATIONS = 3;

/**
 * Ordered candidate queries for "songs that go well with this one".
 * Same-artist queries come first (strongest signal); a mood/genre seed follows.
 * Deduped, capped. Empty artist → only the mood seed(s).
 */
export function recommendationQueries(source: RecoSource, limit = MAX_RECOMMENDATIONS): string[] {
  const artist = parseArtist(source);
  const core = coreTitle(source, artist);
  const out: string[] = [];
  if (artist) {
    out.push(`${artist} 인기곡`);
    out.push(`${artist} 노래`);
  }
  if (core) out.push(`${core} 비슷한 노래`);
  if (!out.length && source.title) out.push(`${source.title} 비슷한 노래`);

  const seen = new Set<string>();
  return out.filter((q) => {
    const k = q.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, Math.max(limit, 1) + 1); // one extra query as headroom for resolution
}
