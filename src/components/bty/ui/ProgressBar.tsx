export type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  className?: string;
};

/**
 * BTY Phase 1 — 정적 와이어용 진행 바. API 값 아님(표시만).
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div className={className}>
      {label ? <div className="mb-1 text-xs text-bty-secondary">{label}</div> : null}
      <div className="h-2 overflow-hidden rounded-full bg-bty-border">
        <div
          className="h-full rounded-full bg-bty-navy"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showPercent ? <div className="mt-1 text-xs tabular-nums text-bty-muted">{pct}%</div> : null}
    </div>
  );
}
