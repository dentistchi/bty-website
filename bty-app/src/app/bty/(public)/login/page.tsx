import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  // ✅ Next 15: useSearchParams()를 쓰는 Client 컴포넌트는
  //    Server boundary에서 Suspense로 감싸야 prerender 시 빌드 에러가 나지 않음
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
