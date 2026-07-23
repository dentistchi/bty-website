'use client';

// B2 — the web Admin's FREE-minutes usage surface. PURELY presentational: it renders
// the server-truth projection (domain/usage.ts, resolved server-side) and re-derives
// NOTHING — no thresholds, no remaining math, no reset calculation. The same
// `bannerKind` drives the native SwiftUI Admin, so the two clients can never disagree.
//
// Visual language (§10/§11): warnings are CALM (amber), never red. Red is reserved for
// the genuine block (zero + idle). PRO and enforcement-disabled show no FREE countdown.

import type { UsageProjection } from '@/domain/usage';

/** mm:ss from a non-negative second count (server-clamped; never negative). */
function fmtRemaining(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Format the SERVER-PROVIDED reset instant in the account timezone. This only formats
 * an instant the server computed (nextResetAt) — it never recalculates the boundary.
 */
function fmtReset(iso: string | null, tz: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz ?? undefined,
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export default function UsageBanner({ usage }: { usage: UsageProjection | null }) {
  // No data yet, PRO (unlimited), or enforcement disabled → no FREE surface at all.
  // (§11: PRO shows no countdown; disabled shows no active-enforcement warning.)
  if (!usage) return null;
  if (usage.bannerKind === 'pro' || usage.bannerKind === 'disabled') return null;

  const remaining = usage.remainingSeconds ?? 0;
  const reset = fmtReset(usage.nextResetAt, usage.timezone);
  const resetLine = reset ? `${reset}에 초기화돼요` : null;

  // Calm amber for warnings; a firmer (but not error-red) tone for zero-while-playing;
  // red only for the true block (zero + idle).
  const palette: Record<string, { bg: string; border: string; fg: string }> = {
    normal: { bg: 'rgba(41,52,74,0.55)', border: 'rgba(120,140,180,0.35)', fg: '#dbe5ff' },
    five_min: { bg: 'rgba(120,90,20,0.30)', border: 'rgba(230,180,80,0.45)', fg: '#ffe6b0' },
    two_min: { bg: 'rgba(140,90,20,0.38)', border: 'rgba(240,170,70,0.55)', fg: '#ffdf9e' },
    zero_playing: { bg: 'rgba(150,80,30,0.40)', border: 'rgba(240,150,80,0.60)', fg: '#ffd7b0' },
    zero_idle: { bg: 'rgba(120,30,40,0.42)', border: 'rgba(230,90,110,0.65)', fg: '#ffd0d8' },
  };
  const p = palette[usage.bannerKind] ?? palette.normal;

  let title: string;
  let detail: string | null = null;
  switch (usage.bannerKind) {
    case 'normal':
      title = `FREE · 오늘 남은 무료 시간 ${fmtRemaining(remaining)}`;
      detail = resetLine;
      break;
    case 'five_min':
      title = '무료 이용 시간이 5분 남았어요';
      detail = '재생 중인 곡은 끝까지 부를 수 있어요.';
      break;
    case 'two_min':
      title = '무료 이용 시간이 2분 남았어요';
      detail = '시간이 끝나기 전에 시작한 곡은 끝까지 부를 수 있어요.';
      break;
    case 'zero_playing':
      title = '오늘 무료 이용 시간을 모두 사용했어요';
      detail = '이 곡은 끝까지 부를 수 있지만, 다음 곡은 시작할 수 없어요.';
      break;
    case 'zero_idle':
      title = '오늘 무료 이용 시간을 모두 사용했어요';
      detail = resetLine
        ? `PRO로 업그레이드하면 다음 곡을 지금 시작할 수 있어요. ${resetLine}.`
        : 'PRO로 업그레이드하면 다음 곡을 지금 시작할 수 있어요.';
      break;
    default:
      return null;
  }

  return (
    <div
      className="usage-banner"
      role={usage.bannerKind === 'zero_idle' ? 'alert' : 'status'}
      data-banner-kind={usage.bannerKind}
      aria-live="polite"
      style={{
        margin: '10px 0',
        padding: '10px 14px',
        borderRadius: 12,
        background: p.bg,
        border: `1px solid ${p.border}`,
        color: p.fg,
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      <strong style={{ fontWeight: 700 }}>{title}</strong>
      {detail && <div style={{ opacity: 0.9, marginTop: 2 }}>{detail}</div>}
    </div>
  );
}
