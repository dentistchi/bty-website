// NOTE:
// 이 페이지는 빌드/프리렌더 단계에서도 안전해야 하므로
// useSearchParams() 같은 client hook을 사용하지 않고
// Next.js App Router의 searchParams prop을 사용합니다.

type SearchParams = Record<string, string | string[] | undefined>;

export default function ForbiddenPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const rawNext = searchParams?.next;
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
