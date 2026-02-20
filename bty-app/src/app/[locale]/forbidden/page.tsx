import Link from "next/link";

export const dynamic = "force-static";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ForbiddenPage({ params }: Props) {
  const { locale: localeParam } = await params;
  const locale = localeParam ?? "en";

  // locale-aware 경로들 (필요하면 여기만 바꾸면 됨)
  const homeHref = `/${locale}`;
  const loginHref = `/${locale}/bty/login?next=%2Fbty`;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-2xl p-6 bg-white">
        <h1 className="text-xl font-semibold mb-2">Access denied</h1>
        <p className="text-sm text-gray-600 mb-6">
          You don&apos;t have permission to view this page.
        </p>

        <div className="flex gap-3">
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 border"
          >
            Go home
          </Link>

          <Link
            href={loginHref}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 bg-black text-white"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}
