import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";
import { approveEliteSpecNomination } from "@/engine/integration/elite-spec-flow";

export const runtime = "nodejs";

/**
 * POST /api/admin/arena/elite-spec-nominations/:id/approve — mentor/admin approval → grant + APPROVED row.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const result = await approveEliteSpecNomination(id);
  if (!result.ok) {
    const status =
      result.error === "nomination_not_found"
        ? 404
        : result.error === "invalid_status" || result.error === "grant_exists"
          ? 409
          : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
