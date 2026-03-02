"use client";

import { cn } from "@/lib/utils";

/**
 * 종이 질감 느낌의 카드 — Center 톤 (둥근 모서리, 부드러운 그림자)
 */
export function PaperCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-dear-bg-paper border border-dear-charcoal/6",
        "shadow-paper",
        "p-6 sm:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}
