import ArenaShellLayout from "@/components/arena/ArenaShellLayout";

type Props = { params: Promise<{ locale: string }> };

/**
 * Arena session shell — stacked narrative / delayed outcomes / feedback + {@link ScenarioSessionShell}.
 */
export default async function ArenaPage({ params }: Props) {
  const { locale } = await params;
  const loc = locale === "ko" ? "ko" : "en";
  return <ArenaShellLayout locale={loc} />;
}
