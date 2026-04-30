import { redirect } from "next/navigation";

export default async function LabPage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const resolved = await params;
  const locale = resolved?.locale === "ko" ? "ko" : "en";
  redirect(`/${locale}/bty-arena`);
}
