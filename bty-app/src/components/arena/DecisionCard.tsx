import { cn } from "@/lib/utils";

export type DecisionCardProps = {
  label: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
  /** Entire row locked (e.g. after a choice is final). */
  locked?: boolean;
  /** Subdued non-selected options after another is locked. */
  dimmed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** @deprecated Prefer `onClick` — kept for call sites that used the mission prototype name. */
  onSelect?: () => void;
  /** Primary = cyan emphasis row; secondary = reinforcement row (matches legacy `variant`). */
  size?: "primary" | "secondary";
  /** Legacy alias for `size` (primary | reinforcement). */
  variant?: "primary" | "reinforcement";
  testId?: string;
};

function rowStyle(
  size: "primary" | "secondary",
  variant: "primary" | "reinforcement" | undefined,
): "primary" | "secondary" {
  if (variant === "reinforcement") return "secondary";
  if (variant === "primary") return "primary";
  return size;
}

export default function DecisionCard({
  label,
  title,
  subtitle,
  selected,
  locked = false,
  dimmed,
  disabled,
  onClick,
  onSelect,
  size = "primary",
  variant,
  testId,
}: DecisionCardProps) {
  const row = rowStyle(size, variant);
  const handle = onClick ?? onSelect;
  const isDisabled = disabled !== undefined ? disabled : Boolean(locked && !selected);

  return (
    <button
      type="button"
      data-testid={testId}
      data-selected={selected ? "true" : undefined}
      disabled={isDisabled}
      onClick={handle}
      className={cn(
        "w-full rounded-2xl border text-left transition-all duration-200",
        row === "primary"
          ? "border-cyan-300/20 bg-cyan-400/[0.08] px-4 py-4"
          : "border-white/10 bg-white/[0.04] px-4 py-3",
        selected && "ring-1 ring-cyan-300/40 shadow-[0_0_24px_rgba(34,211,238,0.15)]",
        dimmed && !selected && "opacity-45",
        !isDisabled && !(dimmed && !selected) && "hover:-translate-y-0.5 hover:border-white/20",
        isDisabled && "cursor-not-allowed",
      )}
    >
      <div className="mb-2 flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-cyan-200">
          {label}
        </span>
      </div>
      <div className="text-sm font-semibold leading-6 text-white">{title}</div>
      {subtitle ? <div className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</div> : null}
    </button>
  );
}
