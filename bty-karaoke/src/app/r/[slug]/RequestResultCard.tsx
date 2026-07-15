'use client';

import type { YoutubeSearchItem } from '@/domain/youtube-search';
import { badgeForVideo } from '@/domain/video-kind';
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
          <div className="title">{item.title}</div>
          <div className="muted">{item.channelTitle}</div>
          {(() => {
            const badge = badgeForVideo(item.title, item.channelTitle);
            return badge ? (
              <span className={`vk-badge vk-${badge.tone}`}>
                {badge.emoji} {badge.label}
              </span>
            ) : null;
          })()}
        </div>
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
    </SwipeableCard>
  );
}
