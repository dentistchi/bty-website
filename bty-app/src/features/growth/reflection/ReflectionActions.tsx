import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  locale: string;
  hasSeed: boolean;
  onOpenReflection: () => void;
  onReturnToArena: () => void;
};

export function ReflectionActions({ locale, hasSeed, onOpenReflection, onReturnToArena }: Props) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  return (
    <div
      data-testid="growth-reflection-actions"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <button
        type="button"
        data-testid="open-reflection-write"
        onClick={onOpenReflection}
        disabled={!hasSeed}
        className={cn(
          "h-12 rounded-2xl px-4 text-sm font-medium transition",
          hasSeed
            ? "bg-[#1E2A38] text-white hover:bg-[#243446]"
            : "cursor-not-allowed bg-white/[0.05] text-slate-500",
        )}
      >
        {t.growthReflectionOpenReflection}
      </button>

      <button
        type="button"
        onClick={onReturnToArena}
        className="h-12 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
      >
        {t.growthReflectionReturnArena}
      </button>
    </div>
  );
}
