import Link from "next/link";

export type BottomNavItem = {
  label: string;
  href: string;
  active?: boolean;
};

export type BottomNavProps = {
  items: BottomNavItem[];
  className?: string;
  "aria-label"?: string;
};

const linkBase =
  "flex-1 rounded-xl px-2 py-2 text-center text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2 focus-visible:ring-offset-bty-soft";

/**
 * Arena 하단 3탭 (BTY_COMPONENT_PROPS_SPEC §7). 활성·포커스 visible.
 */
export function BottomNav({
  items,
  className = "",
  "aria-label": ariaLabel = "Main navigation",
}: BottomNavProps) {
  return (
    <nav className={`flex gap-1 ${className}`} aria-label={ariaLabel}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${linkBase} ${
            item.active
              ? "bg-bty-navy text-white ring-offset-bty-surface"
              : "text-bty-secondary hover:bg-bty-surface hover:text-bty-text"
          }`}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
