import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { GlassPanel } from "./GlassPanel";

type Props = {
  locale: string;
  visible: boolean;
  onOpenRecovery: () => void;
};

export function OptionalRecoveryPromptCard({ locale, visible, onOpenRecovery }: Props) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  if (!visible) return null;

  return (
    <GlassPanel data-testid="growth-recovery-prompt" className="p-5">
      <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/70">
        {t.growthReflectionSectionRecovery}
      </div>
      <div className="mt-4 space-y-4">
        <p className="text-sm leading-7 text-slate-300">{t.growthRecoveryCardBody}</p>
        <button
          type="button"
          onClick={onOpenRecovery}
          className="h-11 w-full rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.08] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/[0.12]"
        >
          {t.growthReflectionOpenRecovery}
        </button>
      </div>
    </GlassPanel>
  );
}
