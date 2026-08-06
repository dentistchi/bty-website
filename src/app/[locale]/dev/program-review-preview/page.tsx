import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PreviewClient } from "./PreviewClient";

/**
 * `/[locale]/dev/program-review-preview` — the non-paid physical readability gate
 * (Slice 3.2L-R5).
 *
 * ENVIRONMENT. Reachable in development and on staging; a real production deployment gets
 * `notFound()`. The guard mirrors the existing `api/dev/reset-arena-state` convention
 * rather than inventing a second rule.
 *
 * HONEST SCOPE, worth stating plainly: today BTY runs ONE live Worker and it is configured
 * `BTY_ENV=staging`, so this route IS reachable there — which is exactly what the Founder
 * device gate needs, and also means anyone holding the URL can open it. That is acceptable
 * only because the page is inert and carries nothing private: a hard-coded fixture about an
 * invented team, no draft id, no Host answers, no prompt, no provider response, and no API
 * call of any kind. If a production-configured environment is ever introduced, this 404s
 * there without further work.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Program review preview (test)",
  robots: { index: false, follow: false },
};

function previewAllowed(): boolean {
  const env = process.env.BTY_ENV?.trim().toLowerCase();
  return process.env.NODE_ENV !== "production" || env === "staging";
}

/**
 * CLIENT BUILD IDENTITY (Slice 3.2L-R6.4).
 *
 * A physical recording has to prove WHICH source rendered it. The R6.2 gate reported a
 * defect that did not exist in the deployed commit, and the most likely explanation — a
 * stale client bundle — was unfalsifiable from the recording alone.
 *
 * This reads the SAME environment chain `/api/version` reads, in a server component on a
 * `force-dynamic` route. So the banner and `/api/version` cannot disagree: they are the
 * same value read on the same request. No new env var, nothing `NEXT_PUBLIC_`, no client
 * fetch, and no guess — if the Worker cannot identify itself the banner says so rather than
 * inventing a plausible SHA.
 */
function clientBuildSha(): string {
  return (
    process.env.BTY_SOURCE_COMMIT_SHA?.trim() ||
    process.env.BTY_DEPLOY_VERSION?.trim() ||
    process.env.DEPLOY_VERSION?.trim() ||
    process.env.CF_PAGES_COMMIT_SHA?.trim() ||
    ""
  );
}

export default function ProgramReviewPreviewPage() {
  if (!previewAllowed()) notFound();
  const sha = clientBuildSha();
  return <PreviewClient buildSha={sha ? sha.slice(0, 8) : "unidentified"} />;
}
