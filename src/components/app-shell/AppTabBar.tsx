"use client";

/**
 * New BTY Daily App — bottom 5-tab bar (v0). Purpose-built for the app shell:
 * NOT the legacy web `BottomNav` (which carries web-shell assumptions — fixed
 * global positioning, forced-reset suppression, arena-entry resolution). This
 * bar is a flex child of {@link BtyDailyAppShell}, so it never floats over content.
 * Self-contained dark surface → readable regardless of the surface behind it.
 */

export type AppTabKey = "today" | "center" | "arena" | "foundry" | "me";

/** 18px inline glyphs (currentColor stroke); path data only, no legacy import. */
const TAB_ICON: Record<AppTabKey, string> = {
  today: "M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5",
  center: "M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10Z",
  arena: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4v0",
  foundry: "M14 3l-1 7h5l-9 11 1-8H5l9-10Z",
  me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
};

/** Tab labels are brand-consistent English on both locales (mirrors product nav). */
const TABS: ReadonlyArray<{ key: AppTabKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "center", label: "Center" },
  { key: "arena", label: "Arena" },
  { key: "foundry", label: "Foundry" },
  { key: "me", label: "Me" },
];

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
}: {
  active: AppTabKey;
  onSelect: (key: AppTabKey) => void;
}) {
  return (
    <nav
      aria-label="App navigation"
      className="shrink-0 border-t border-white/10 bg-[#0B1F3AF2] backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSelect(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A66B]/40 ${
                isActive ? "text-[#C9A66B]" : "text-white/60 hover:text-white/85"
              }`}
            >
              {isActive ? (
                <span aria-hidden className="absolute top-0 h-0.5 w-6 rounded-full bg-[#C9A66B]" />
              ) : null}
              <TabIcon tabKey={tab.key} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
