// V8 pass-turn (Option B). Admin-initiated: complete the current playing song and,
// if the canonical first waiting song is BOTH Ready and Queued on the TV, auto-
// start it in BTY — so the Admin doesn't press Play every song. This flips BTY
// state ONLY; it never controls YouTube. Admin/DJ authenticated, event-gated.
// POST { currentId }.

import { NextRequest, NextResponse } from 'next/server';
import { roomCredentialFromRequest } from '@/lib/dj-auth.server';
import { authorizeDj, passTurnAndPromote } from '@/lib/rooms.server';
import { getCanonicalEvent, resolveEventAccess } from '@/lib/events.server';
import { scheduleLyricsResolve } from '@/lib/lyrics-resolver.server';
import { projectEntitlement } from '@/domain/usage';
import {
  durationBlockCopy,
  publishAdmissionFields,
  PASS_INSUFFICIENT_COPY,
} from '@/domain/admission-copy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const cred = roomCredentialFromRequest(req);
  if (!cred) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const auth = await authorizeDj(slug, cred);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  const access = await resolveEventAccess(auth.room);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, code: access.code }, { status: access.status, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: NO_STORE });
  }
  const currentId = (body as { currentId?: unknown }).currentId;
  if (typeof currentId !== 'string' || !currentId) {
    return NextResponse.json({ error: 'currentId is required' }, { status: 400, headers: NO_STORE });
  }

  // Scope the next-song lookup to the LIVE event's rows (V7.1).
  const live = await getCanonicalEvent(auth.room.id);
  const result = await passTurnAndPromote(auth.room.id, currentId, live?.id ?? null);

  // A new song was auto-promoted to the stage → resolve its lyrics in the background.
  if (result.promoted?.id) void scheduleLyricsResolve(auth.room.id, result.promoted.id);

  // B2: the current song completed (§6 — never force-stopped); when the next start is
  // blocked by the FREE limit the response carries reason='upgrade_required' + the usage
  // snapshot. The next request stays waiting/ready and no YouTube handoff occurs.
  //
  // BUILD 23 — the same is now true for the two fail-closed admission blocks, which used to be
  // flattened into `needs_ready`. THE STATUS STAYS 200 AND `completed` STAYS TRUE: the current
  // song genuinely completed, and turning this into a 4xx/5xx would make every shipped client
  // treat a successful terminal transition as a total failure and re-fire the mutation.
  const blocked = result.reason === 'duration_unavailable' || result.reason === 'pass_insufficient';
  return NextResponse.json(
    {
      ok: true,
      completed: result.completed,
      promoted: result.promoted ? { id: result.promoted.id } : null,
      reason: result.reason,
      usage: result.reason === 'upgrade_required' ? projectEntitlement(result.entitlement) : null,
      // BUILD 24-G1 — publish the SAME allowlisted admission detail on `upgrade_required` that
      // the blocked reasons already publish. Without it the console could only say "all time
      // used", which is false whenever the balance is non-zero and merely too short for this
      // song. `publishAdmissionFields` omits every key the authority did not supply, so an
      // older client sees exactly the payload it saw before.
      ...(result.reason === 'upgrade_required' ? publishAdmissionFields(result) : {}),
      // Everything below is ADDITIVE and present only on the two new reasons. An older client
      // never sees these keys, and — because it does not recognise the new `reason` — falls
      // through its existing `reason !== 'promoted'` branch to exactly today's behaviour.
      ...(blocked
        ? {
            // The canonical id of the request that was REFUSED. Both clients key their durable
            // notice to this and nothing else: a same-song repeat (18B) is a legitimately
            // different request, so videoId/title/position could never identify it correctly.
            blockedRequestId: result.blocked?.id ?? null,
            // One wording source shared with /dj/start (@/domain/admission-copy), so the two
            // paths can never drift into describing the same block differently.
            message:
              result.reason === 'pass_insufficient'
                ? PASS_INSUFFICIENT_COPY
                : durationBlockCopy(result.durationFailureReason),
            // Only when the resolver actually classified one — never defaulted.
            ...(result.durationFailureReason ? { durationFailureReason: result.durationFailureReason } : {}),
            // The approved public admission subset, omitted key-by-key when the authority did
            // not supply it. No account id, pass grant id, segment id, or charge window can
            // reach this response — the allowlist is the only path in.
            ...publishAdmissionFields(result),
          }
        : {}),
    },
    { headers: NO_STORE },
  );
}
