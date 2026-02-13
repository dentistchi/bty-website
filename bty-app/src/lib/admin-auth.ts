/**
 * Server-side admin auth guard.
 * Use in API routes to require admin session.
 */

import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { isAdmin } from "./rbac";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL;

export type AdminSession = {
  email: string | null;
  roles?: string[];
  sub?: string;
};

/**
 * Returns admin session if authenticated and authorized.
 * Returns null if not authenticated or not admin.
 */
export async function requireAdminSession(
  req: NextRequest
): Promise<AdminSession | null> {
  const token = await getToken({
    req,
    secret: NEXTAUTH_SECRET,
    secureCookie: NEXTAUTH_URL?.startsWith("https"),
  });
  if (!token) return null;

  const session = {
    user: { email: token.email ?? null },
    expires: String(token.exp ?? ""),
    roles: token.roles as string[] | undefined,
  };

  if (!isAdmin(session as Parameters<typeof isAdmin>[0])) return null;

  return {
    email: (token.email as string) ?? null,
    roles: token.roles as string[] | undefined,
    sub: token.sub ?? undefined,
  };
}
