import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared full-viewport background for Lobby / Mission Play / Resolve */
export function ArenaSimulationShell({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-white",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
