import { Suspense } from "react";
import ElitePageClient from "./page.client";
import { PageLoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

export default function ElitePage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <ElitePageClient />
    </Suspense>
  );
}
