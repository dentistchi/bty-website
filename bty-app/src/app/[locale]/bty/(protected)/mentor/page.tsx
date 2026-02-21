import { Suspense } from "react";
import ClientPage from "./page.client";

// useSearchParams 등 CSR bail-out 훅이 있는 페이지는 정적 프리렌더 대상이 아니므로 동적 처리
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ClientPage />
    </Suspense>
  );
}
