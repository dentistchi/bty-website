import { NextRequest } from "next/server";
import { requireManager, managerJson, attachJoinUrl } from "@/lib/bty/foundry/events/managerGate";
import { publishDraft, type Locale } from "@/lib/bty/foundry/events/foundryPublishService";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/modules/[id]/publish — publish an approved-ready builder
 * draft into a live Foundry event through the canonical transaction (event +
 * immutable module snapshot + participant content + QR). Manager-gated + owner-
 * scoped. Body: optional { locale } (drives ONLY the blank-completion-prompt
 * default). Returns the control-room snapshot incl. join_url (200; `reused: true`
 * on an idempotent replay). 400 with the failing reason on a not-ready draft,
 * 404 non-disclosing if not owned/missing, 409 on a publish conflict.
 *
 * Placed at `modules/[id]/publish` (static child of a dynamic segment) — the same
 * proven shape as `events/[eventId]/close`; NOT a route nested under a dynamic
 * sibling (which the opennextjs-cloudflare runtime router shadows).
 */
function statusForReason(reason: string): number {
  if (reason === "draft_not_found") return 404;
  if (reason === "draft_not_mutable" || reason === "publish_conflict" || reason === "draft_not_publishable") return 409;
  // A program draft is being written for this training right now — a recoverable
  // conflict the Host resolves by waiting or discarding, never a server error.
  if (reason === "program_generation_in_progress") return 409;
  // Authority could not be established. Nothing was published; the Host retries. 503 —
  // a temporary inability to answer, not a conflict and not a client error.
  if (reason === "program_generation_state_unavailable") return 503;
  // Assigned-overlay outcomes (Slice 3.1B-3C): a resolvable-but-empty audience is a
  // deliberate block the Host must resolve (change audience or pick Open link), not a
  // server error and not a silent Everyone fallback.
  if (reason === "zero_recipients") return 409;
  if (reason === "not_a_host") return 403;
  // Slice 3.2R-R6 — the document is attached but BTY could not read how long it is. The Host
  // resolves it by reopening or replacing the file; nothing was published.
  if (reason === "material_page_count_unverified") return 400;
  /*
    Slice 3.2Q-R1 — two states where the SESSION EXISTS. Neither is a failed creation, and
    neither may be reported as one. 409: the durable publish is there and something about it
    could not be reconciled or displayed; the Host's action is to reopen, not to create again.
  */
  if (reason === "session_created_view_unavailable" || reason === "publish_receipt_unreconciled") return 409;
  if (reason === "assignment_write_failed") return 500;
  return 400;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const { user, admin, base } = gate.ctx;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const locale: Locale = body?.locale === "en" ? "en" : "ko";

  // Participation mode (Slice 3.1B-3C). Absent / anything but the explicit assigned value ⇒
  // OPEN_LINK, so existing publishes and any legacy client are unchanged. The client sends
  // only the DECLARED audience (type + optional detail) the Builder already supports; the
  // server resolves the actual recipients and never trusts a client member/org/count.
  const participation =
    body?.participationMode === "assigned_overlay"
      ? {
          mode: "assigned_overlay" as const,
          audience: {
            audienceType: body?.audienceType,
            audienceDetail:
              typeof body?.audienceDetail === "string" && body.audienceDetail.trim()
                ? body.audienceDetail.trim()
                : null,
          },
        }
      : { mode: "open_link" as const };

  const result = await publishDraft(admin, user.id, id, locale, participation);
  if (!result.ok) return managerJson(base, req, { error: result.reason }, statusForReason(result.reason));

  // The confirmation UI reads `participation` — the ACTUAL committed mode + assignment
  // count from the server write, never the pre-publish preview (Slice 3.1B-3C fix).
  return managerJson(base, req, {
    ...attachJoinUrl(req, result.value.snapshot),
    reused: result.value.reused,
    participation: result.value.participation,
  });
}
