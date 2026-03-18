import Link from "next/link";

export type TabPillItem = {
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
};

export type TabPillsProps = {
  items: TabPillItem[];
  className?: string;
  "aria-label"?: string;
};

/**
 * My Page 등 하위 탭 (BTY_COMPONENT_PROPS_SPEC §6).
 */
export function TabPills({
  items,
  className = "",
  "aria-label": ariaLabel = "Tabs",
}: TabPillsProps) {
  return (
    <div
      className={`flex flex-wrap gap-1 border-t border-slate-100 pt-3 ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item, i) => {
        const key = `${item.label}-${i}`;
        if (item.disabled || !item.href) {
          return (
            <span
              key={key}
              className="rounded-lg px-2 py-1.5 text-xs text-slate-300"
              aria-disabled
            >
              {item.label}
            </span>
          );
        }
        return (
          <Link
            key={key}
            href={item.href}
            role="tab"
            aria-selected={item.active ?? false}
            className={`rounded-lg px-2 py-1.5 text-xs font-medium ${
              item.active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
