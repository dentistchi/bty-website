import type { ReflectionSeed } from "@/features/growth/logic/buildReflectionSeed";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { GlassPanel } from "./GlassPanel";

function focusLabel(focus: ReflectionSeed["focus"] | null, locale: Locale): string {
  const t = getMessages(locale).uxPhase1Stub;
  if (!focus) return t.growthReflectionFocusReady;
  switch (focus) {
    case "clarity":
      return t.growthReflectionFocusClarity;
    case "trust":
      return t.growthReflectionFocusTrust;
    case "regulation":
      return t.growthReflectionFocusRegulation;
    case "alignment":
    default:
      return t.growthReflectionFocusAlignment;
  }
}

type Props = {
  locale: string;
  focus: ReflectionSeed["focus"] | null;
};

export function ReflectionHeader({ locale, focus }: Props) {
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(loc).uxPhase1Stub;

  return (
    <GlassPanel className="p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">
            {t.growthReflectionAirlockEyebrow}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.growthReflectionAirlockTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{t.growthReflectionAirlockLead}</p>
        </div>

        <div className="w-full shrink-0 lg:min-w-[180px] lg:max-w-[220px]">
          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.06] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">
              {t.growthReflectionFocusChannel}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{focusLabel(focus, loc)}</p>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
