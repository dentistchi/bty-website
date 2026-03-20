import type { ReactNode } from "react";

/** Match play/resolve: break out of ArenaLayoutShell content width for full simulation canvas. */
export default function ArenaLobbyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen max-w-none px-0">
      {children}
    </div>
  );
}
