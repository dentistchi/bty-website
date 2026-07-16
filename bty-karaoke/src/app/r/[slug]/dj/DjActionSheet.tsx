'use client';

import { useEffect, useRef, useState } from 'react';
import type { KaraokeRequest } from '@/lib/rooms.server';
import { displaySong } from '@/domain/song-title';

interface Props {
  request: KaraokeRequest;
  busy: boolean;
  /** Whether this song can move up / down (false at the ends of the line). */
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onMoveNext: (id: string) => void;
  onRemove: (id: string) => void;
  /** Lyrics V1: open the lyrics editor for this queued song. */
  onEditLyrics: (id: string) => void;
  onClose: () => void;
}

// BTY-styled queue action sheet — replaces window.confirm(). Singer-first header,
// two fast actions (먼저 부르기 / 곡 빼기 with an in-sheet confirm), backdrop +
// Escape dismissal, focus trap, and focus restored to the opener on close.
export default function DjActionSheet({
  request,
  busy,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onMoveNext,
  onRemove,
  onEditLyrics,
  onClose,
}: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    // Focus the sheet's first action.
    const first = sheetRef.current?.querySelector<HTMLElement>('button');
    first?.focus();
    return () => {
      // Restore focus to whatever opened the sheet (the overflow button).
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = sheetRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables || focusables.length === 0) return;
    const list = Array.from(focusables);
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const { song, artist } = displaySong(request.youtube_title ?? '', request.youtube_channel_title);
  const singer = request.guest_name;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${singer}님의 신청곡 ${song}${artist ? ` — ${artist}` : ''} 순서 관리`}
        ref={sheetRef}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-eyebrow">다음 순서를 조정할까요?</div>
        <div className="sheet-singer">{singer}</div>
        <div className="sheet-song">
          신청곡 · {song}
          {artist ? ` — ${artist}` : ''}
        </div>

        {confirmRemove ? (
          <div className="sheet-confirm">
            <p className="sheet-confirm-q">{singer}의 신청곡을 대기열에서 뺄까요?</p>
            <div className="sheet-actions">
              <button type="button" className="sheet-btn ghost" onClick={() => setConfirmRemove(false)}>
                계속 대기
              </button>
              <button
                type="button"
                className="sheet-btn coral"
                disabled={busy}
                onClick={() => onRemove(request.id)}
              >
                ✕ 곡 빼기
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="sheet-move" role="group" aria-label="한 칸씩 순서 이동">
              <button
                type="button"
                className="sheet-btn ghost"
                disabled={busy || !canMoveUp}
                onClick={() => onMoveUp(request.id)}
                aria-label={`${singer} 신청곡 한 칸 위로`}
              >
                ↑ 위로
              </button>
              <button
                type="button"
                className="sheet-btn ghost"
                disabled={busy || !canMoveDown}
                onClick={() => onMoveDown(request.id)}
                aria-label={`${singer} 신청곡 한 칸 아래로`}
              >
                ↓ 아래로
              </button>
            </div>
            <div className="sheet-actions two">
              <button
                type="button"
                className="sheet-btn coral"
                onClick={() => setConfirmRemove(true)}
                aria-label={`${singer} 신청곡 대기열에서 빼기`}
              >
                ✕ 곡 빼기
              </button>
              <button
                type="button"
                className="sheet-btn gold"
                disabled={busy || !canMoveUp}
                onClick={() => onMoveNext(request.id)}
                aria-label={`${singer} 신청곡 맨 앞으로 (먼저 부르기)`}
              >
                ↑ 먼저 부르기
              </button>
            </div>
            <button
              type="button"
              className="sheet-btn ghost sheet-lyrics"
              onClick={() => onEditLyrics(request.id)}
              aria-label={`${singer} 신청곡 가사 편집`}
            >
              {request.lyrics_text?.trim() ? '📝 가사 수정' : '📝 가사 직접 입력'}
            </button>
            <button type="button" className="sheet-close linkish" onClick={onClose}>
              닫기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
