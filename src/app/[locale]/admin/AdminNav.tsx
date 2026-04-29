"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LangSwitch } from "@/components/LangSwitch";

const NAV_ITEMS = [
  { key: "debug",               label: "Debug" },
  { key: "quality",             label: "Quality" },
  { key: "leadership-metrics",  label: "리더십 지표" },
  { key: "users",               label: "Users" },
  { key: "organizations",       label: "Orgs" },
  { key: "arena-membership",    label: "Membership" },
  { key: "sql-migrations",      label: "SQL" },
];

export default function AdminNav({ locale }: { locale: string }) {
  const pathname = usePathname();
  if (pathname?.includes("/admin/login")) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-neutral-200 bg-white shadow-sm">
      <div className="container mx-auto flex h-full max-w-6xl items-center gap-0.5 px-4">
        <span className="mr-3 shrink-0 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
          Admin
        </span>
        {NAV_ITEMS.map(({ key, label }) => {
          const href = `/${locale}/admin/${key}`;
          const active = Boolean(pathname?.includes(`/admin/${key}`));
          return (
            <Link
              key={key}
              href={href}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <span className="ml-auto flex shrink-0 items-center border-l border-neutral-200 pl-3">
          <LangSwitch />
        </span>
      </div>
    </nav>
  );
}
