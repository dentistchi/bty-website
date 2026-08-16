// My Songs — account-scoped saved-song library (BUILD 20A).
//
// The account is ALWAYS resolved from the session by the route (host-auth.server);
// every function here takes an already-authorized `accountId` and scopes every query
// by it. Nothing in this module reads Room/Event/request/queue/entitlement state —
// it touches ONE table, karaoke_user_saved_songs, and nothing else.
//
// Ownership rules that must never regress:
//   * save is idempotent on (account_id, video_id) — the UNIQUE index is the truth,
//     and the upsert refreshes the snapshots but PRESERVES the original created_at.
//   * list returns only the caller account's rows, in a deterministic order.
//   * delete is account-scoped, owner-only, and idempotent — deleting an absent (or
//     another account's) row returns the SAME success, revealing nothing about
//     whether such a row exists for anyone else.

import { karaokeDb } from './supabase.server';

const TABLE = 'karaoke_user_saved_songs';

/** The privacy-appropriate projection the app may show. Never account_id / internal rows. */
export interface SavedSong {
  /** The stable BTY row UUID — the only durable handle once retention clears `videoId`. */
  savedSongId: string;
  /** NULL after a retention transition. Never a placeholder. */
  videoId: string | null;
  title: string | null;
  artist: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  /** True when a factual retention refresh determined this item HARD_UNAVAILABLE. */
  youtubeUnavailable: boolean;
}

interface SavedSongRow {
  id: string;
  video_id: string | null;
  title_snapshot: string | null;
  artist_snapshot: string | null;
  thumbnail_url_snapshot: string | null;
  created_at: string;
  updated_at: string;
  youtube_metadata_unavailable_at: string | null;
}

// R6 §G — the stable BTY row id now travels with every library read. It is what the id-addressed
// delete needs, and after a retention transition it is the ONLY way to address the row at all,
// because `video_id` is NULL by then.
const ROW_COLS = 'id, video_id, title_snapshot, artist_snapshot, thumbnail_url_snapshot, created_at, updated_at, youtube_metadata_unavailable_at';

function project(r: SavedSongRow): SavedSong {
  // R6 §G — cleared fields are returned as they ARE: null. No placeholder title, channel,
  // thumbnail or video id is manufactured, because a fake value is indistinguishable from a real
  // one downstream and the client must be able to tell that this row has no YouTube identity.
  //
  // The provenance seal is deliberately absent: it is a WRITE credential, never library state.
  return {
    savedSongId: r.id,
    videoId: r.video_id ?? null,
    title: r.title_snapshot ?? null,
    artist: r.artist_snapshot ?? null,
    thumbnailUrl: r.thumbnail_url_snapshot ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    youtubeUnavailable: r.youtube_metadata_unavailable_at != null,
  };
}

export interface SaveSongInput {
  /** VERIFIER-returned sealed instant, or null. Never a client-supplied timestamp. */
  youtubeMetadataFetchedAt?: Date | null;
  videoId: string;
  title: string;
  artist?: string | null;
  thumbnailUrl?: string | null;
}

/**
 * Save ONE song into the account's library, idempotent on (account_id, video_id).
 * First save inserts one row; a repeat refreshes the snapshots + updated_at but keeps
 * the original created_at (so a metadata refresh never re-orders the library). Returns
 * the canonical saved item.
 */
export async function saveSavedSong(accountId: string, input: SaveSongInput): Promise<SavedSong> {
  const now = new Date().toISOString();
  const { data, error } = await karaokeDb()
    .from(TABLE)
    .upsert(
      {
        account_id: accountId,
        video_id: input.videoId,
        title_snapshot: input.title,
        artist_snapshot: input.artist ?? null,
        thumbnail_url_snapshot: input.thumbnailUrl ?? null,
        // Passed on both paths: on INSERT it equals the default; on CONFLICT it is the
        // only timestamp updated. created_at is deliberately NOT written, so a conflict
        // preserves it.
        updated_at: now,
        // BUILD 26T-R1B-R6-R1B-R3 — freshness follows the METADATA, not the row.
        //
        // This upsert REPLACES title/artist/thumbnail on every call, so §J's preserve-on-unrelated
        // -update case cannot arise here: there is no path through this function that leaves the
        // snapshot untouched. What can arise is the opposite hazard — replacing the metadata while
        // keeping an older timestamp, which would leave that timestamp describing metadata it never
        // saw. So an unverifiable save writes NULL rather than inheriting the previous instant.
        //
        // Only the verifier's sealed value is ever written; there is no client-timestamp fallback.
        youtube_metadata_fetched_at: input.youtubeMetadataFetchedAt
          ? input.youtubeMetadataFetchedAt.toISOString()
          : null,
      },
      { onConflict: 'account_id,video_id' },
    )
    .select(ROW_COLS)
    .single();
  if (error) throw error;
  return project(data as SavedSongRow);
}

/** The account's saved songs, newest first (created_at DESC, id DESC as a stable tiebreak). */
export async function listSavedSongs(accountId: string): Promise<SavedSong[]> {
  const { data, error } = await karaokeDb()
    .from(TABLE)
    .select(ROW_COLS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return (data as SavedSongRow[] | null ?? []).map(project);
}

/**
 * Remove a saved song from THIS account's library. Scoped by (account_id, video_id)
 * — never by video_id alone — so it can only ever delete the caller's own row, and is
 * idempotent: an absent row (never saved, already removed, or owned by someone else)
 * returns the same terminal success without disclosing whether such a row exists.
 */
export async function deleteSavedSong(
  accountId: string,
  videoId: string,
): Promise<{ deleted: true; videoId: string }> {
  const { error } = await karaokeDb()
    .from(TABLE)
    .delete()
    .eq('account_id', accountId)
    .eq('video_id', videoId);
  if (error) throw error;
  return { deleted: true, videoId };
}


/**
 * R6 §F — remove a saved song by its STABLE BTY row id.
 *
 * WHY THIS EXISTS. The videoId-keyed route cannot address a row whose retention transition set
 * `video_id` to NULL, so without this the owner would be unable to delete their own library entry
 * — the row would be stuck forever. This is additive; the legacy route is untouched.
 *
 * SECURITY. Scoped by (id, account_id) — never by id alone. A caller cannot delete another
 * account's row by guessing a UUID, and the response is identical whether the row was absent,
 * already removed, or owned by someone else, so it discloses nothing. Same idempotent terminal
 * success as the videoId route.
 */
export async function deleteSavedSongById(
  accountId: string,
  savedSongId: string,
): Promise<{ deleted: true; savedSongId: string }> {
  const { error } = await karaokeDb()
    .from(TABLE)
    .delete()
    .eq('id', savedSongId)
    .eq('account_id', accountId); // THE ownership predicate — removing it is mutant N-M1
  if (error) throw error;
  return { deleted: true, savedSongId };
}
