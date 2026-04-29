import Link from "next/link";
import type { ReactNode } from "react";

export type SecondaryButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
};

const base =
  "inline-flex w-full items-center justify-center rounded-2xl border border-bty-border bg-bty-surface px-4 py-3 text-center text-sm font-medium text-bty-text outline-none transition-colors hover:border-bty-steel/30 hover:bg-bty-soft focus-visible:ring-2 focus-visible:ring-bty-steel focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-bty-border disabled:bg-bty-soft disabled:text-bty-muted";

export function SecondaryButton({
  children,
  href,
  onClick,
  disabled,
  className = "",
  type = "button",
}: SecondaryButtonProps) {
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
