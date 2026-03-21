import { JournalLoadingShell } from "./JournalLoadingShell";

/** `/[locale]/journal/loading` — 세그먼트 Suspense 시 `<main>` 랜드마크 */
export default function JournalRouteLoading() {
  return <JournalLoadingShell />;
}
