import BtyArenaRunPageClient from "./BtyArenaRunPageClient";

/**
 * Canonical Arena route: `useArenaSession` + `POST /api/arena/run` + session router
 * (`/api/arena/session/next` when `ARENA_PIPELINE_DEFAULT=legacy`, `/api/arena/n/session` when `new`).
 */
export default function BtyArenaPage() {
  return <BtyArenaRunPageClient pipelineDefault="new" />;
}
