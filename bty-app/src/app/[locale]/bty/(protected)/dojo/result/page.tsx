import DojoResultClient from "./ui/DojoResultClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function DojoResultPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  return <DojoResultClient locale={lang} />;
}
