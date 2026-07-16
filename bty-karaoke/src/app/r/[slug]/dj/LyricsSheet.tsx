'use client';

import { useEffect, useRef, useState } from 'react';
import type { KaraokeRequest } from '@/lib/rooms.server';
import { displaySong } from '@/domain/song-title';
import { MAX_LYRICS_LEN } from '@/domain/lyrics';

interface Props {
  request: KaraokeRequest;
  /** Save the current textarea contents. Empty string clears. Resolves true on OK. */
  onSave: (id: string, lyrics: string) => Promise<boolean>;
  onClose: () => void;
}

// Admin lyrics editor — add / edit / clear the words the iPad Display shows for a
// song. Plain-text only (a textarea; the Display renders it as text, never HTML).
// Pre-filled from the request's saved lyrics so "edit" and "clear" are the same
// flow: erase everything and Save to clear. Double-submit is blocked while in
// flight, and a successful save closes so the Display picks it up on its next poll.
export default function LyricsSheet({ request, onSave, onClose }: Props) {
  const [value, setValue] = useState(request.lyrics_text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    areaRef.current?.focus();
    return () => {
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }

  async function save() {
    if (saving) return; // block double-submit
    setSaving(true);
    setError(null);
    const ok = await onSave(request.id, value);
    setSaving(false);
    if (ok) onClose();
    else setError('가사를 저장하지 못했어요. 다시 시도해 주세요.');
  }

  const { song, artist } = displaySong(request.youtube_title ?? '', request.youtube_channel_title);
  const had = Boolean(request.lyrics_text && request.lyrics_text.trim());
  const willClear = value.trim().length === 0;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="action-sheet lyrics-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${request.guest_name}님의 신청곡 ${song} 가사 편집`}
        ref={sheetRef}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-eyebrow">가사 {had ? '편집' : '추가'}</div>
        <div className="sheet-singer">{request.guest_name}</div>
        <div className="sheet-song">
          {song}
          {artist ? ` — ${artist}` : ''}
        </div>

        <textarea
          ref={areaRef}
          className="lyrics-input"
          value={value}
          maxLength={MAX_LYRICS_LEN}
          onChange={(e) => setValue(e.target.value)}
          placeholder="가사를 붙여넣거나 입력하세요. 비워두고 저장하면 가사가 지워집니다."
          rows={10}
          disabled={saving}
        />
        <div className="lyrics-meta">
          <span className="lyrics-count">
            {value.length.toLocaleString()} / {MAX_LYRICS_LEN.toLocaleString()}
          </span>
          {had && willClear && <span className="lyrics-clearhint">저장하면 가사가 지워집니다</span>}
        </div>

        {error && <p className="lyrics-error" role="alert">{error}</p>}

        <div className="sheet-actions two">
          <button type="button" className="sheet-btn ghost" onClick={onClose} disabled={saving}>
            취소
          </button>
          <button type="button" className="sheet-btn gold" onClick={() => void save()} disabled={saving}>
            {saving ? '저장 중…' : willClear ? '가사 지우기' : '가사 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
