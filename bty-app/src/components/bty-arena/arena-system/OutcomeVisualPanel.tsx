import { cn } from "@/lib/utils";

export type OutcomeVisualPanelProps = {
  badge?: string;
  subline?: string;
  testId?: string;
};

export function OutcomeVisualPanel({
  badge = "Decision Recorded",
  subline = "Case state stabilized",
  testId = "arena-outcome-visual",
}: OutcomeVisualPanelProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "relative h-[640px] overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl",
        "bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.10),_transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]",
      )}
    >
      <div className="absolute left-5 top-5 rounded-full border border-cyan-300/20 bg-slate-950/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100/80 backdrop-blur-md">
        {badge}
      </div>

      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-[0.3em] text-slate-500">post-decision scene placeholder</div>
          <div className="mt-4 text-lg font-medium text-slate-300">{subline}</div>
        </div>
      </div>
    </div>
  );
}
