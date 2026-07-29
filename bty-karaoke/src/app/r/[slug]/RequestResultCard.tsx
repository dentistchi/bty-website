'use client';

import type { YoutubeSearchItem } from '@/domain/youtube-search';
import { badgeForVideo } from '@/domain/video-kind';
import { songDisplay } from '@/domain/song-title';
import SwipeableCard from './SwipeableCard';

interface Props {
  item: YoutubeSearchItem;
  onRequest: (item: YoutubeSearchItem) => void;
  pending: boolean;
  /** Briefly true right after a successful request — shows "✓ 신청됨". */
  requested?: boolean;
  variant?: 'primary' | 'reco';
  /** BUILD 20B-WEB7 — this videoId is in the device saved library ("내 노래"). */
  saved?: boolean;
  /** A save/unsave for this videoId is in flight. */
  savePending?: boolean;
  /** Toggle the bookmark. Independent from 신청하기 — never creates a request. */
  onToggleSave?: (item: YoutubeSearchItem) => void;
}

// A requestable song card. Right-swipe reveals the gold 🎤 신청하기 surface; the
// always-visible "신청" button triggers the exact same action for discoverability
// and accessibility. Both feel like placing the song onto the stage.
export default function RequestResultCard({
  item,
  onRequest,
  pending,
  requested = false,
  variant = 'primary',
  saved = false,
  savePending = false,
  onToggleSave,
}: Props) {
  const act = () => {
    if (!pending) onRequest(item);
  };
  const label = pending ? '신청 중…' : requested ? '✓ 신청됨' : '신청 →';
  // Display-only projection — the raw item.title/channelTitle are unchanged and are
  // what a request/save still stores. The provider name never eats the title line.
  const disp = songDisplay(item.title, item.channelTitle);
  const badge = badgeForVideo(item.title, item.channelTitle);
  return (
    <SwipeableCard
      direction="right"
      tone="gold"
      icon="🎤"
      label="신청하기"
      disabled={pending}
      onCommit={act}
    >
      <div className={`req-card ${variant}`}>
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="thumb" src={item.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <div className="thumb placeholder" aria-hidden />
        )}
        <div className="grow">
          <div className="title clamp-2">{disp.title}</div>
          {disp.artist && <div className="song-artist">{disp.artist}</div>}
          {(disp.sourceLabel || badge) && (
            <div className="song-meta">
              {disp.sourceLabel ? (
                // Prefer the ONE compact provider indicator (TJ/KY/MR/NWC) over the
                // generic "노래방" category label when we know the source.
                <span className="src-badge">{disp.sourceLabel}</span>
              ) : (
                badge && (
                  <span className={`vk-badge vk-${badge.tone}`}>
                    {badge.emoji} {badge.label}
                  </span>
                )
              )}
            </div>
          )}
        </div>
        <div className="req-card-actions">
          {onToggleSave && (
            <button
              type="button"
              className={`save-btn${saved ? ' on' : ''}`}
              onClick={(e) => {
                // A bookmark tap must never bubble into the swipe-to-request gesture,
                // and never triggers 신청 — save is fully independent from the queue.
                e.stopPropagation();
                if (!savePending) onToggleSave(item);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={savePending}
              aria-pressed={saved}
              aria-label={saved ? `${item.title} 저장 해제` : `${item.title} 저장`}
              title={saved ? '저장 해제' : '내 노래에 저장'}
            >
              {saved ? '★' : '☆'}
            </button>
          )}
          <button
            type="button"
            className={`req-btn${requested ? ' done' : ''}`}
            onClick={act}
            disabled={pending}
            aria-label={`${item.title} 신청하기`}
          >
            {label}
          </button>
        </div>
      </div>
    </SwipeableCard>
  );
}
