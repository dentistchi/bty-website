import Link from "next/link";

export type MyPageSubNavActive = "overview" | "progress" | "team" | "leader";

type Props = {
  locale: string;
  active: MyPageSubNavActive;
};

const tabs: { id: MyPageSubNavActive; segment: string; label: string }[] = [
  { id: "overview", segment: "", label: "Overview" },
  { id: "progress", segment: "progress", label: "Progress" },
  { id: "team", segment: "team", label: "Team" },
  { id: "leader", segment: "leader", label: "Leader" },
];

/**
 * My Page 하위 탭 (와이어 §3). Account 라우트는 Phase 1 범위 밖.
 */
export function MyPageSubNav({ locale, active }: Props) {
  const base = `/${locale}/my-page`;
  return (
    <nav className="flex flex-wrap gap-2" aria-label="My Page sections">
      {tabs.map(({ id, segment, label }) => {
        const href = segment ? `${base}/${segment}` : base;
        const isOn = id === active;
        return (
          <Link
            key={id}
            href={href}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isOn
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
            aria-current={isOn ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
