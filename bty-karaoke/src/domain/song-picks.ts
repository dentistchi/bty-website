// BTY's editorial song ideas, independent of provider charts and YouTube metadata.
// A pick is a SEARCH QUERY, never a playable video or an already-submitted request.
import catalog from '@/data/bty-song-picks.json';

export const SONG_PICK_CATEGORIES = [
  'together', 'party', 'ballad', 'memories', 'kpop', 'pop',
] as const;

export type SongPickCategory = (typeof SONG_PICK_CATEGORIES)[number];

export interface SongPick {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly category: SongPickCategory;
  readonly language: 'ko' | 'en';
  readonly searchQuery: string;
}

export const SONG_PICKS_VERSION = catalog.version;
export const SONG_PICKS: readonly SongPick[] = catalog.songs as SongPick[];
