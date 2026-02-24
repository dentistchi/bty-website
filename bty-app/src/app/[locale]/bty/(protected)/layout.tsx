import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LangSwitch } from "@/components/LangSwitch";

export default function BtyProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-end gap-4 flex-nowrap shrink-0">
          <div className="flex items-center gap-3 flex-nowrap">
            <LangSwitch />
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
