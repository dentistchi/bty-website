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
