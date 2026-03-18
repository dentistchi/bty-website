import Link from "next/link";

/** 카드 푸터 등 좁은 영역용 3탭 행 (선택적). */
export type BottomNavRowItem = {
  label: string;
  href: string;
  active?: boolean;
};

const linkBase =
  "flex-1 rounded-xl px-2 py-2 text-center text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2 focus-visible:ring-offset-bty-soft";

export function BottomNavRow({
  items,
  className = "",
  "aria-label": ariaLabel = "Main navigation",
}: {
  items: BottomNavRowItem[];
  className?: string;
  "aria-label"?: string;
}) {
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
