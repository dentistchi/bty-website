import { redirect } from "next/navigation";
import { getMessages, type Locale } from "@/lib/i18n";
import { getSupabaseServer } from "@/lib/supabase-server";
import { AcceptClient } from "./AcceptClient";

export const dynamic = "force-dynamic";

export default async function LegalAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ return?: string }>;
}) {
  const { locale } = await params;
  const { return: returnUrl } = await searchParams;
  const m = getMessages(locale);

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/bty/login`);
  }

  const { data: prof } = await supabase
    .from("arena_profiles")
    .select("consent_version")
    .eq("user_id", user.id)
    .maybeSingle();

  const safeReturn = returnUrl && returnUrl.startsWith("/") ? returnUrl : `/${locale}/bty`;

  if (prof?.consent_version) {
    redirect(safeReturn);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold mb-2">{m.legal.accept.title}</h1>
        <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded mb-6">
          {m.legal.accept.placeholder_notice}
        </p>

        <div className="text-sm text-gray-700 mb-6">{m.legal.accept.section_heading}</div>

        <AcceptClient locale={locale} returnUrl={safeReturn} />
      </div>
    </main>
  );
}
