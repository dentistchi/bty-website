import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getUnlockedDayFromCompletions } from "@/lib/trainProgress";
import TrainDayPage from "./page.client";

type DayParams = { locale: string; day: string };

export default async function Page({ params }: { params: Promise<DayParams> }) {
  const { locale, day: dayParam } = await params;
  const day = Number(dayParam);

  // 미인증은 train/layout auth가 이미 처리 — 여기선 user null-safe 게이트만.
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      // 잠긴 day 직접 진입 → 보드로 차단 (L-3A 완료체인 헬퍼 재사용)
      if (day > todayUnlockedDay) {
        redirect(`/${locale}/train/28days`);
      }
    }
  }

  // 통과 시 기존 client 본체 렌더 (useTrain으로 progress 자체 fetch — props 불요).
  return <TrainDayPage />;
}
