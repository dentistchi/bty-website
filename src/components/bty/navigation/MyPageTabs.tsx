import Link from "next/link";

type Tab = "overview" | "progress" | "team" | "leader";

export type MyPageTabsProps = {
  locale: string;
  active: Tab;
};

const tabs: { id: Tab; label: string; path: string }[] = [
  { id: "overview", label: "Overview", path: "" },
  { id: "progress", label: "Progress", path: "/progress" },
  { id: "team", label: "Team", path: "/team" },
  { id: "leader", label: "Leader", path: "/leader" },
];

/**
 * My Page 와이어 §3 탭. Account 탭은 Phase 1 범위 밖 — 4탭만.
 */
export function MyPageTabs({ locale, active }: MyPageTabsProps) {
  const base = `/${locale}/my-page`;
  return (
    <nav
      className="flex flex-wrap gap-2 border-t border-slate-100 pt-4"
      aria-label="My Page sections"
    >
      {tabs.map((t) => {
        const href = `${base}${t.path}`;
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={href}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
