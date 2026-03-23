import BtyArenaRunPageClient from "./BtyArenaRunPageClient";

/**
 * Canonical Arena route: API run/session flow (`useArenaSession`, `/api/arena/run`, `/api/arena/session/next`).
 * `/bty-arena/run` redirects here. Hub: `/bty-arena/hub`. Run detail: `/bty-arena/run/[runId]`.
 */
export default function BtyArenaPage() {
  return <BtyArenaRunPageClient />;
}
