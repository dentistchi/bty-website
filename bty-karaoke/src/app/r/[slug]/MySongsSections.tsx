'use client';

// "방금 부른 노래" (Recently Sung) + "내 노래" (My Songs) — BUILD 20B-WEB7 Phases 6–8.
//
// Two INDEPENDENT collapsible sections (a plain disclosure, never a tab system or
// modal). Recently Sung shows the Guest's own just-finished performances (by
// requestId) with a bookmark to save them into My Songs. My Songs shows the device
// saved library (by videoId) with 신청하기 (reuses the existing request pipeline) and
// 저장 해제. Neither section mutates queue/Event state — only the saved library.

import { useState } from 'react';
import { songDisplay } from '@/domain/song-title';
import type { RecentlySung } from '@/domain/recently-sung';
import type { SavedSong, SavedSongSnapshot } from '@/domain/saved-songs';

interface Props {
  recentlySung: readonly RecentlySung[];
  saved: readonly SavedSong[];
  isSaved: (videoId: string) => boolean;
  isSavePending: (videoId: string) => boolean;
  /** Bookmark a Recently-Sung performance into My Songs (toggle). */
  onToggleSave: (song: SavedSongSnapshot) => void;
  /** Request a saved song — reuses the exact existing web request pipeline. */
  onRequestSaved: (song: SavedSong) => void;
  /** Remove a saved song (저장 해제). Never touches the queue. */
  onRemoveSaved: (videoId: string) => void;
  /** Whether a request may be placed right now (Event live + room open). */
  canParticipate: boolean;
  /** videoId whose request is currently in flight (one-at-a-time pipeline). */
  requestPendingVideoId: string | null;
}

export default function MySongsSections({
  recentlySung,
  saved,
  isSaved,
  isSavePending,
  onToggleSave,
  onRequestSaved,
  onRemoveSaved,
  canParticipate,
  requestPendingVideoId,
}: Props) {
  // Both default COLLAPSED. Neither auto-expands on a new performance or a save.
  const [recentOpen, setRecentOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);

  return (
    <div className="my-songs">
      {/* 방금 부른 노래 — the header appears ONLY when there is history (count > 0). */}
      {recentlySung.length > 0 && (
        <section className="ms-section" aria-label="방금 부른 노래">
          <button
            type="button"
            className="ms-head"
            aria-expanded={recentOpen}
            onClick={() => setRecentOpen((v) => !v)}
          >
            <span className="ms-caret" aria-hidden>{recentOpen ? '▾' : '▸'}</span>
            <span className="ms-title">방금 부른 노래</span>
            <span className="ms-count">{recentlySung.length}</span>
          </button>
          {recentOpen && (
            <ul className="ms-list">
              {recentlySung.map((r) => {
                const song = songDisplay(r.title, r.artist);
                const canSave = !!r.videoId;
                const on = canSave && isSaved(r.videoId!);
                return (
                  <li className="ms-row" key={r.requestId}>
                    <div className="ms-row-main">
                      <div className="ms-row-song">{song.title || r.title}</div>
                      {song.artist && <div className="ms-row-artist">{song.artist}</div>}
                    </div>
                    {canSave && (
                      <button
                        type="button"
                        className={`save-btn${on ? ' on' : ''}`}
                        onClick={() =>
                          onToggleSave({
                            videoId: r.videoId!,
                            title: r.title,
                            artist: r.artist,
                            thumbnailUrl: r.thumbnailUrl,
                          })
                        }
                        disabled={isSavePending(r.videoId!)}
                        aria-pressed={on}
                        aria-label={on ? `${song.title || r.title} 저장 해제` : `${song.title || r.title} 저장`}
                        title={on ? '저장 해제' : '내 노래에 저장'}
                      >
                        {on ? '★' : '☆'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* 내 노래 — the header is ALWAYS visible, including at count 0. */}
      <section className="ms-section" aria-label="내 노래">
        <button
          type="button"
          className="ms-head"
          aria-expanded={savedOpen}
          onClick={() => setSavedOpen((v) => !v)}
        >
          <span className="ms-caret" aria-hidden>{savedOpen ? '▾' : '▸'}</span>
          <span className="ms-title">내 노래</span>
          <span className="ms-count">{saved.length}</span>
        </button>
        {savedOpen &&
          (saved.length === 0 ? (
            <div className="ms-empty">
              <p className="ms-empty-title">저장한 노래가 아직 없어요</p>
              <p className="ms-empty-sub">노래를 부른 뒤 북마크를 눌러 저장해 보세요</p>
            </div>
          ) : (
            <ul className="ms-list">
              {saved.map((s) => {
                const song = songDisplay(s.title, s.artist);
                const pending = requestPendingVideoId === s.videoId;
                return (
                  <li className="ms-row" key={s.videoId}>
                    <div className="ms-row-main">
                      <div className="ms-row-song">{song.title || s.title}</div>
                      {song.artist && <div className="ms-row-artist">{song.artist}</div>}
                    </div>
                    <div className="ms-row-actions">
                      {canParticipate ? (
                        <button
                          type="button"
                          className="ms-request"
                          onClick={() => onRequestSaved(s)}
                          disabled={pending}
                          aria-label={`${song.title || s.title} 신청하기`}
                        >
                          {pending ? '신청 중…' : '신청하기'}
                        </button>
                      ) : (
                        <span className="ms-row-note">이벤트가 열리면 신청할 수 있어요</span>
                      )}
                      <button
                        type="button"
                        className="ms-remove linkish"
                        onClick={() => onRemoveSaved(s.videoId)}
                        disabled={isSavePending(s.videoId)}
                        aria-label={`${song.title || s.title} 저장 해제`}
                      >
                        저장 해제
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}
      </section>
    </div>
  );
}
