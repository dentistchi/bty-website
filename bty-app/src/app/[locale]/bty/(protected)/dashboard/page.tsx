import { Suspense } from "react";
import DashboardClient from "./page.client";

// useSearchParams in (protected) layout (LangSwitch) requires dynamic + Suspense
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <DashboardClient />
    </Suspense>
  );
}
