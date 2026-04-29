import { Suspense } from "react";
import ClientPage from "./page.client";
import { PageLoadingFallback } from "@/components/bty-arena";

// CSR hook(useSearchParams/useRouter/...) 페이지는 정적 프리렌더 대상이 아니므로 동적 처리
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <ClientPage />
    </Suspense>
  );
}
