import { cn } from "@/lib/utils";

export type ArenaTopBarProps = {
  stage: string;
  level: string;
  codename: string;
  progress: number;
  /** e2e / analytics */
  testId?: string;
  /** 접근성: 상단 스테이지 바 랜드마크 */
  "aria-label"?: string;
};

export default function ArenaTopBar({
  stage,
  level,
  codename,
  progress,
  testId = "arena-top-bar",
  "aria-label": ariaLabel,
}: ArenaTopBarProps) {
  return (
    <header
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(
        "rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4",
        "shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-semibold tracking-[0.28em] text-white/90">BTY ARENA</div>

        <div className="text-sm uppercase tracking-[0.2em] text-slate-300">{stage}</div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm font-medium text-white">{level}</div>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-300/80 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{codename}</div>
        </div>
      </div>
    </header>
  );
}
