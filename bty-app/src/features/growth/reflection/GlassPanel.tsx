import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassPanel({
  children,
  className,
  "data-testid": dataTestId,
}: {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <section
      data-testid={dataTestId}
      className={cn(
        "rounded-[2rem] border border-white/10 bg-white/[0.05] shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}
