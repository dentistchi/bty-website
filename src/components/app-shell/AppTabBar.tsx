"use client";

/**
 * New BTY Daily App — bottom 5-tab bar (v0). Purpose-built for the app shell:
 * NOT the legacy web `BottomNav` (which carries web-shell assumptions — fixed
 * global positioning, forced-reset suppression, arena-entry resolution). This
 * bar is a flex child of {@link BtyDailyAppShell}, so it never floats over content.
 * Self-contained dark surface → readable regardless of the surface behind it.
 */

/**
 * App Shell + Today Simplification V1: the visible bottom navigation is FOUR learner-facing
 * actions — Today · Learn · Practice · Me. The prior five developer-facing domains map beneath
 * this bar (Learn = Foundry, Practice = Arena + Field Actions, Center/Recovery folds into Me);
 * canonical internal names are untouched and only translated here at the UI/navigation layer.
 */
export type AppTabKey = "today" | "learn" | "practice" | "me";

/** 18px inline glyphs (currentColor stroke); path data only, no legacy import. */
const TAB_ICON: Record<AppTabKey, string> = {
  today: "M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5",
  // Learn — an open book (Foundry, translated to product language).
  learn: "M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5 1.5-1.5 4-2 8-1.5V5c-4-.5-6.5 0-8 1.5Zm0 0V20",
  // Practice — the Arena target ring (reused so the practice identity carries the Arena glyph).
  practice: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4v0",
  me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
};

type Locale = "en" | "ko";

/** Tab ORDER is fixed; the canonical AppTabKey values never change — only the VISIBLE label is
 *  localized (EN/KO parity). Route names, query params, and deep-link aliases are unaffected. */
const TAB_ORDER: readonly AppTabKey[] = ["today", "learn", "practice", "me"];

const TAB_LABELS: Record<Locale, Record<AppTabKey, string>> = {
  en: { today: "Today", learn: "Learn", practice: "Practice", me: "Me" },
  ko: { today: "오늘", learn: "배우기", practice: "연습", me: "나" },
};

function TabIcon({ tabKey }: { tabKey: AppTabKey }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={TAB_ICON[tabKey]} />
    </svg>
  );
}

export default function AppTabBar({
  active,
  onSelect,
  locale,
}: {
  active: AppTabKey;
  onSelect: (key: AppTabKey) => void;
  locale?: string;
}) {
  const loc: Locale = locale === "ko" ? "ko" : "en";
  const labels = TAB_LABELS[loc];
  return (
    <nav
      data-bty-bottom-nav=""
      aria-label="App navigation"
      className="shrink-0 border-t border-white/10 bg-[#0B1F3AF2] backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-4">
        {TAB_ORDER.map((key) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40 ${
                isActive ? "text-[#C9A66B]" : "text-white/60 hover:text-white/85"
              }`}
            >
              {isActive ? (
                <span aria-hidden className="absolute top-0 h-0.5 w-6 rounded-full bg-[#C9A66B]" />
              ) : null}
              <TabIcon tabKey={key} />
              <span>{labels[key]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
