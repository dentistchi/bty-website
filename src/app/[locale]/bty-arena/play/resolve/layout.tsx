import type { ReactNode } from "react";

/**
 * Break out of ArenaLayoutShell max-w-6xl so Resolve matches full-width simulation spec.
 */
export default function ArenaPlayResolveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen max-w-none px-0">
      {children}
    </div>
  );
}
