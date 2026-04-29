import { cn } from "@/lib/utils";

export type SealedDecisionCardProps = {
  label: string;
  title: string;
  subtitle?: string;
  variant: "primary" | "reinforcement";
};

export default function SealedDecisionCard({ label, title, subtitle, variant }: SealedDecisionCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-4",
        variant === "primary"
          ? "border-cyan-300/20 bg-cyan-400/[0.08]"
          : "border-white/10 bg-white/[0.04]",
      )}
    >
      <div className="mb-2 flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-cyan-200">
          {label}
        </span>
      </div>
      <div className="text-sm font-semibold leading-6 text-white">{title}</div>
      {subtitle ? <div className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</div> : null}
    </div>
  );
}
