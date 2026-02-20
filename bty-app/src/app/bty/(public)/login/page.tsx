import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  // ✅ Server Component에서 Suspense로 감싸면
  // useSearchParams()를 쓰는 Client Component가 CSR bailout 하더라도
  // Next.js 빌드(prerender) 에러가 안 난다.
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
