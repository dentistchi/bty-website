import { Suspense } from "react";
import DashboardClient from "./page.client";
import { LoadingFallback } from "@/components/bty-arena";

// useSearchParams in (protected) layout (LangSwitch) requires dynamic + Suspense
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6" style={{ maxWidth: 980, margin: "0 auto" }}>
          <LoadingFallback
            icon="⏳"
            message="잠시만 기다려 주세요."
            withSkeleton
          />
        </div>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
