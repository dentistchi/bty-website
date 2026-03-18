import JourneyDayClient from "@/components/bty/journey/JourneyDayClient";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{
    locale: string;
    day: string;
  }>;
};

export default async function JourneyDayPage({ params }: PageProps) {
  const { locale, day } = await params;
  const n = Number.parseInt(day, 10);
  if (!Number.isFinite(n) || n < 1 || n > 28) {
    notFound();
  }
  const loc = locale === "ko" ? "ko" : "en";
  return <JourneyDayClient locale={loc} day={n} />;
}
