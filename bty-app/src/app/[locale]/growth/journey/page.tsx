import JourneyClient from "@/components/bty/journey/JourneyClient";

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Growth → Journey. Server entry; profile fetch + modals live in JourneyClient.
 */
export default async function GrowthJourneyPage({ params }: PageProps) {
  const { locale } = await params;
  const loc = locale === "ko" ? "ko" : "en";
  return <JourneyClient locale={loc} />;
}
