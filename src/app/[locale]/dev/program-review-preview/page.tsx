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

export default function ProgramReviewPreviewPage() {
  if (!previewAllowed()) notFound();
  return <PreviewClient />;
}
