import { redirect } from "next/navigation";

type DayParams = { locale: string; day: string };

// legacy 라우트: 정본 /train/day/[day]로 흡수 (TrainDayClient는 빈 스텁이라 콘텐츠 손실 0).
export default async function Page({ params }: { params: Promise<DayParams> }) {
  const { locale, day } = await params;
  redirect(`/${locale}/train/day/${day}`);
}
