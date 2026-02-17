import type { NextRequest } from "next/server";

export function getScopeFromRequest(req: NextRequest) {
  const url = new URL(req.url);

  const orgId =
    url.searchParams.get("orgId") ??
    req.headers.get("x-org-id") ??
    "";

  const regionId =
    url.searchParams.get("regionId") ??
    req.headers.get("x-region-id") ??
    "";

  return { orgId, regionId };
}
