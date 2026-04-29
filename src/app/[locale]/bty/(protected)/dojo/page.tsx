import DojoClient from "./ui/DojoClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function DojoPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale === "ko" ? "ko" : "en";
  return <DojoClient locale={lang} />;
}
