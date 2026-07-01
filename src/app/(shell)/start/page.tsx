import { Suspense } from "react";
import { PageLoadingFallback } from "@/components/bty-arena";
import StartShellClient from "./page.client";

// App Shell v0 — "Morning 30s" ritual. Root-level (shell) route group: inherits ONLY the
// root layout (AuthProvider / fonts / globals + --bty-orb-* tokens) — NOT the [locale] layout,
// so no header / chatbot / comeback / Capacitor bridge. Single client phase machine; phases
// are internal state, not separate routes. force-dynamic: client auth gate + CSR hooks.
export const dynamic = "force-dynamic";

export default function StartShellPage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <StartShellClient />
    </Suspense>
  );
}
