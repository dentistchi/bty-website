import { ArenaPracticePlayClient } from "./ArenaPracticePlayClient";

/**
 * Play a Foundry-published Arena practice. Learner-facing, approved-member gated
 * server-side by the API it calls. Isolated from the canonical rotation runtime.
 */
export default async function ArenaPracticePlayPage({
  params,
}: {
  params: Promise<{ locale: string; practiceId: string }>;
}) {
  const { locale, practiceId } = await params;
  return <ArenaPracticePlayClient locale={locale} practiceId={practiceId} />;
}
