// NOTE:
// Next.js 15(App Router)에서는 searchParams가 Promise로 타입 잡히는 케이스가 있어
// 빌드(프리렌더) 단계 타입 에러를 피하려면 Promise 형태로 받아 await 해서 사용합니다.

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};
  const rawNext = sp.next;
  const next =
    typeof rawNext === "string"
      ? rawNext
      : Array.isArray(rawNext)
        ? rawNext[0] ?? "/"
        : "/";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 bg-white">
        <h1 className="text-xl font-semibold mb-2">Forbidden</h1>
        <p className="text-sm text-gray-600 mb-4">
          You do not have permission to access this page.
        </p>
        <a
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 bg-black text-white"
          href={next}
        >
          Go back
        </a>
      </div>
    </main>
  );
}
