import Link from "next/link";
import type { ReactNode } from "react";

type LinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

/** 와이어 Primary — 가장 먼저 눌러야 할 행동 (§1 Play Game 등) */
export function WirePrimaryLink({ href, children, className }: LinkProps) {
  return (
    <Link
      href={href}
      className={`block w-full rounded-2xl bg-slate-900 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}

/** 와이어 Secondary — Continue, 보조 행동 */
export function WireSecondaryLink({ href, children, className }: LinkProps) {
  return (
    <Link
      href={href}
      className={`block w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3.5 text-center text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}
