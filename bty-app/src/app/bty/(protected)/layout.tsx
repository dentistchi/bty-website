import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function BtyProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div data-logout-button className="fixed top-4 right-4 z-[9999]">
        <LogoutButton />
      </div>
      {children}
    </>
  );
}
