import { Suspense } from "react";
import ClientPage from "./page.client";

// reset-password는 URL 토큰/쿼리 기반이라 정적 프리렌더 대상이 아님
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ClientPage />
    </Suspense>
  );
}
