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
        {locale === "en" ? (
          <article className="space-y-5 text-[#1E2A38]">
            <h1 className="text-2xl font-semibold">bty — information notice and consent</h1>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">What bty does</h2>
              <p className="text-sm leading-relaxed">
                bty is a training tool for your dental practice. It helps your team practice
                leadership, decision-making, and integrity skills through realistic scenarios.
                You'll work through situations, make choices, reflect on what happened, and your
                patterns develop over time.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">What we collect</h2>
              <p className="text-sm leading-relaxed">When you use bty, we collect:</p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>
                  <strong>Account information</strong> — your name, work email, and your role at
                  the practice
                </li>
                <li>
                  <strong>Training activity</strong> — the scenarios you engage with, the choices
                  you make, the reflections you write, and how your patterns develop over time
                </li>
                <li>
                  <strong>Technical information</strong> — standard things like browser type and
                  IP address, for security and reliability
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">A note on patient information</h2>
              <p className="text-sm leading-relaxed">
                Do not include patient names or protected health information (PHI) in your training
                reflections or chat messages. bty is not a clinical record system, and your
                reflections are processed by third-party AI services (see below).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Why we collect it</h2>
              <p className="text-sm leading-relaxed">
                Your training activity helps bty personalize scenarios to your growth and lets your
                practice understand team-wide patterns.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">What services help run bty</h2>
              <p className="text-sm leading-relaxed">
                bty uses these services to operate. Each handles your information under its own
                privacy commitments:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>
                  <strong>Cloudflare</strong> — hosts the bty application
                </li>
                <li>
                  <strong>Supabase</strong> — stores your account and training records
                </li>
                <li>
                  <strong>OpenAI</strong> — supports chat, mentor, and training-related AI features
                </li>
              </ul>
              <p className="text-sm leading-relaxed">
                When you write reflections or use chat features, the text you enter may be sent to
                these AI services for processing.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Important notes</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>
                  bty is part of your work environment. Your practice's employee handbook covers
                  how bty fits into your role.
                </li>
                <li>If you have questions or concerns, contact your practice admin.</li>
                <li>
                  You may request deletion of your account information through your practice
                  administrator.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Your acknowledgment</h2>
              <p className="text-sm leading-relaxed">
                By clicking <strong>Accept</strong>, you acknowledge that:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>You've read this notice</li>
                <li>You understand bty is part of your work training</li>
                <li>
                  You consent to bty collecting and using your information as described above
                </li>
              </ul>
            </section>
          </article>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-2">{m.legal.accept.title}</h1>
            <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded mb-6">
              {m.legal.accept.placeholder_notice}
            </p>

            <div className="text-sm text-gray-700 mb-6">{m.legal.accept.section_heading}</div>
          </>
        )}

        <div className="mt-6">
          <AcceptClient locale={locale} returnUrl={safeReturn} />
        </div>
      </div>
    </main>
  );
}
