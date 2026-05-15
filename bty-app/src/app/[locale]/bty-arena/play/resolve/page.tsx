import ArenaResolveClient from "./ArenaResolveClient";

type Props = { params: Promise<{ locale: string }> };

/** Arena Resolve surface — Action Gate (ACTION_REQUIRED / ACTION_SUBMITTED / ACTION_AWAITING_VERIFICATION) per v1.1 §5.3 / FD-6. Entered from Play (/bty-arena/play) via ACTION_DECISION_ACTIVE → ACTION_REQUIRED transition (in-app navigation wired in Stage 2 step 2 sub-phase 2D). */
export default async function ArenaResolvePage({ params }: Props) {
  const { locale } = await params;
  return <ArenaResolveClient locale={locale} />;
}
