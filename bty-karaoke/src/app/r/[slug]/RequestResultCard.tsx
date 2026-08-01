'use client';

import type { YoutubeSearchItem } from '@/domain/youtube-search';
import { badgeForVideo } from '@/domain/video-kind';
import { songDisplay } from '@/domain/song-title';
import { formatDurationLabel } from '@/domain/duration-admission';
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
  // BUILD 22 — the verdict is TRI-STATE and only `too_long` blocks. An absent field (an older
  // server, or a result the enrichment could not resolve) reads as `unknown` and stays fully
  // requestable, so a duration outage never disables the product.
  const admission = item.durationAdmission ?? 'unknown';
  const blocked = admission === 'too_long';
  const durationLabel = formatDurationLabel(item.durationSeconds);

  const act = () => {
    if (!pending && !blocked) onRequest(item);
  };
  const label = blocked ? '신청 불가' : pending ? '신청 중…' : requested ? '✓ 신청됨' : '신청 →';
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
      // A blocked card must not offer the swipe affordance either — otherwise the gesture and
      // the button would disagree about whether this song can be requested.
      disabled={pending || blocked}
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
          {(disp.sourceLabel || badge || durationLabel) && (
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
              {/* BUILD 22 — the length itself, so the Guest can judge before choosing. Rendered
                  only when actually known; there is no "0:00" fallback for an unknown duration. */}
              {durationLabel && <span className="song-duration">{durationLabel}</span>}
            </div>
          )}
          {/* The reason lives in TEXT, never in colour or a disabled style alone — a Guest who
              cannot perceive the greyed button must still learn why, and what to do instead. */}
          {blocked && (
            <div className="song-blocked-note">15분을 초과해 신청할 수 없어요 · 더 짧은 버전을 선택해 주세요</div>
          )}
        </div>
        <div className="req-card-actions">
          <button
            type="button"
            className={`req-btn${requested ? ' done' : ''}${blocked ? ' blocked' : ''}`}
            onClick={act}
            disabled={pending || blocked}
            aria-label={
              blocked
                ? `${item.title} — 15분을 초과해 신청할 수 없습니다`
                : `${item.title} 신청하기`
            }
          >
            {label}
          </button>
        </div>
      </div>
    </SwipeableCard>
  );
}
