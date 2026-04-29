/**
 * RBAC for admin dashboard.
 * Allowed roles: bty_admin, bty_owner.
 * Determination order: App role claim from Entra ID > Email allowlist.
 */

import type { Session } from "next-auth";
import type { SessionWithRoles } from "./auth-nextauth";

const ALLOWED_ROLES = ["bty_admin", "bty_owner"] as const;

function getAdminEmails(): string[] {
  const raw = process.env.BTY_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true if the session user has admin access.
 * A) App role claim (roles array) - if token includes bty_admin or bty_owner
 * B) Email allowlist (BTY_ADMIN_EMAILS) - fallback
 */
export function isAdmin(session: Session | null): boolean {
  if (!session?.user) return false;

  const swr = session as SessionWithRoles;

  // B) App role claim from Entra ID (if configured)
  if (Array.isArray(swr.roles)) {
    if (swr.roles.some((r) => ALLOWED_ROLES.includes(r as (typeof ALLOWED_ROLES)[number]))) {
      return true;
    }
  }

  // A) Email allowlist fallback
  const email = (swr.user?.email ?? "").toLowerCase();
  if (email && getAdminEmails().includes(email)) {
    return true;
  }

  return false;
}
