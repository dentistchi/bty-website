import { redirect } from "next/navigation";
import { type Locale } from "@/lib/i18n";
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
          <article className="space-y-5 text-[#1E2A38]">
            <h1 className="text-2xl font-semibold">bty 안내 및 동의</h1>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">bty란</h2>
              <p className="text-sm leading-relaxed">
                bty는 치과 진료실 팀을 위한 훈련 도구입니다. 실제 진료 환경에서 마주칠 수 있는 상황을
                통해 리더십, 의사결정, 그리고 정직성과 관련된 역량을 연습할 수 있도록 돕습니다.
                시나리오를 마주하고, 선택하고, 결과를 돌아보는 과정에서 사용자의 행동 패턴이 시간에
                따라 발전합니다.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">수집하는 정보</h2>
              <p className="text-sm leading-relaxed">bty 사용 시 다음 정보가 수집됩니다.</p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>
                  <strong>계정 정보</strong> — 이름, 직장 이메일, 진료실 내 역할
                </li>
                <li>
                  <strong>훈련 활동</strong> — 참여한 시나리오, 선택한 응답, 작성한 성찰 내용, 그리고
                  시간에 따른 패턴 변화
                </li>
                <li>
                  <strong>기술 정보</strong> — 보안 및 안정성을 위한 브라우저 종류, IP 주소 등
                  일반적인 기술 데이터
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">환자 정보 관련 주의</h2>
              <p className="text-sm leading-relaxed">
                훈련 성찰이나 채팅 메시지에 환자 이름, 환자 식별 정보 또는 보호 대상 건강정보(PHI)를
                포함하지 마십시오. bty는 진료기록 시스템이 아니며, 사용자가 입력한 성찰 내용은 아래에
                명시된 AI 서비스로 전송되어 처리될 수 있습니다.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">수집 목적</h2>
              <p className="text-sm leading-relaxed">
                훈련 활동 정보는 사용자의 성장에 맞게 시나리오를 조정하고, 진료팀 전체의 패턴을
                이해하는 데 사용됩니다.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">bty 운영에 사용되는 서비스</h2>
              <p className="text-sm leading-relaxed">
                bty는 다음 서비스를 통해 운영됩니다. 각 서비스는 자체 개인정보 처리 방침에 따라 사용자
                정보를 다룹니다.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>
                  <strong>Cloudflare</strong> — bty 애플리케이션 호스팅
                </li>
                <li>
                  <strong>Supabase</strong> — 계정 및 훈련 기록 저장
                </li>
                <li>
                  <strong>OpenAI</strong> — 채팅, 멘토 기능, 그리고 훈련 관련 AI 기능 지원
                </li>
              </ul>
              <p className="text-sm leading-relaxed">
                성찰을 작성하거나 채팅 기능을 사용할 때, 입력하신 내용은 위 AI 서비스로 전송되어
                처리될 수 있습니다.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">중요 사항</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>
                  bty는 업무 환경의 일부입니다. 진료실의 직원 핸드북에 bty가 사용자의 역할에 어떻게
                  포함되는지 안내되어 있습니다.
                </li>
                <li>문의 사항이 있을 경우 진료실 관리자에게 연락하십시오.</li>
                <li>계정 정보의 삭제는 진료실 관리자를 통해 요청하실 수 있습니다.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold">동의</h2>
              <p className="text-sm leading-relaxed">
                <strong>동의합니다</strong> 버튼을 누르시면 다음 내용에 동의하는 것으로 간주됩니다.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed">
                <li>본 안내를 읽으셨습니다</li>
                <li>bty가 업무 훈련의 일부임을 이해하셨습니다</li>
                <li>위에 설명된 내용에 따라 bty가 정보를 수집하고 사용하는 것에 동의하셨습니다</li>
              </ul>
            </section>
          </article>
        )}

        <div className="mt-6">
          <AcceptClient locale={locale} returnUrl={safeReturn} />
        </div>
      </div>
    </main>
  );
}
