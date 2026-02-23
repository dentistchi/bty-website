import { Suspense } from "react";
import ClientPage from "./page.client";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ClientPage />
    </Suspense>
  );
}
