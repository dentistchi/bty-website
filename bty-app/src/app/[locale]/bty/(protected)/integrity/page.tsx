import { Suspense } from "react";
import ClientPage from "./page.client";
import { PageLoadingFallback } from "@/components/bty-arena";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <ClientPage />
    </Suspense>
  );
}
