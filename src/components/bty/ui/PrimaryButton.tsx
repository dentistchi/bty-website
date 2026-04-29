import Link from "next/link";
import type { ReactNode } from "react";

export type PrimaryButtonProps = {
  children: ReactNode;
  /** 있으면 `<Link>`로 렌더 (와이어 네비용) */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
};

const base =
  "inline-flex w-full items-center justify-center rounded-2xl bg-bty-navy px-4 py-3.5 text-center text-sm font-semibold text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * BTY Phase 2 — 최우선 행동 (PIXEL_WIREFRAMES Play / Continue 등).
 */
export function PrimaryButton({
  children,
  href,
  onClick,
  disabled,
  className = "",
  type = "button",
}: PrimaryButtonProps) {
  const c = `${base} ${className}`.trim();
  if (href && !disabled) {
    return (
      <Link href={href} className={c}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={c}>
      {children}
    </button>
  );
}
