import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isActivePlatformAdmin } from "@/lib/bty/authority/platformAdmin.server";
import { getUnlockedDayFromCompletions } from "@/lib/trainProgress";
import TrainDayPage from "./page.client";

type DayParams = { locale: string; day: string };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<DayParams>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale, day: dayParam } = await params;
  const sp = await searchParams;
  const day = Number(dayParam);

  // 미인증은 train/layout auth가 이미 처리 — 여기선 user null-safe 게이트만.
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
    A-1 QA preview (admin-only, fail-closed). `?preview=1` lets a BTY platform admin open a locked
    Day for content review without the completion-chain dance.

    This read an inline copy of the `BTY_ADMIN_EMAILS` allowlist until 2026-09-02. Authority is now
    the canonical `bty_platform_admin_grants` row, keyed by the session's canonical user id — the
    same single source the API layer and the admin console use, so a revoked admin loses the
    preview at the same instant they lose everything else.
  */
  const previewAdminClient = getSupabaseAdmin();
  const isAdmin =
    !!user?.id && !!previewAdminClient && (await isActivePlatformAdmin(previewAdminClient, user.id));
  const allowPreview = sp?.preview === "1" && isAdmin;

  if (user?.id && Number.isFinite(day)) {
    const admin = getSupabaseAdmin();
    if (admin) {
      // admin client는 RLS 우회 → user_id 명시 필터 필수 (progress route와 동일 패턴)
      const { data } = await admin
        .from("train_day_completions")
        .select("day")
        .eq("user_id", user.id);
      const completedDays = (data ?? []).map((r) => Number((r as { day: number }).day));
      const lastCompletedDay = completedDays.length ? Math.max(...completedDays) : 0;
      const todayUnlockedDay = getUnlockedDayFromCompletions(lastCompletedDay);
      // 잠긴 day 직접 진입 → 보드로 차단 (L-3A 완료체인 헬퍼 재사용).
      // A-1: admin preview(?preview=1)는 redirect만 skip — 완료상태 미변경, 렌더 콘텐츠 동일.
      if (day > todayUnlockedDay && !allowPreview) {
        redirect(`/${locale}/train/28days`);
      }
    }
  }

  // 통과 시 기존 client 본체 렌더 (useTrain으로 progress 자체 fetch — props 불요).
  return <TrainDayPage />;
}
