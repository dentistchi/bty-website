import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function BtyProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="p-3 flex justify-end">
        <LogoutButton />
      </div>
      {children}
    </>
  );
}
