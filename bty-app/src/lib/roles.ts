/**
 * Single source of truth for role hierarchy and admin access.
 * Hierarchy (high → low): dso > admin > director > regional_manager > manager > lead > staff
 */

export const ROLE_ORDER = [
  "dso",
  "admin",
  "director",
  "regional_manager",
  "manager",
  "lead",
  "staff",
] as const;

export type Role = (typeof ROLE_ORDER)[number];

/** Roles that can access /admin/* (middleware + API). */
export const ADMIN_ROLES: Role[] = ["dso", "admin", "director"];

export function isAdminRole(role: string | null | undefined): role is Role {
  return typeof role === "string" && ADMIN_ROLES.includes(role as Role);
}

/** Human-readable labels for UI (dropdown, table). */
export const ROLE_LABELS: Record<Role, string> = {
  dso: "DSO",
  admin: "Admin",
  director: "Director",
  regional_manager: "Regional Manager",
  manager: "Manager",
  lead: "Lead",
  staff: "Staff",
};

export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "-";
  return ROLE_LABELS[role as Role] ?? role;
}
