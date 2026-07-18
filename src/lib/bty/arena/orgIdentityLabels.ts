/**
 * Display labels for the canonical identity taxonomy (Slice 3.1A-1).
 *
 * Deliberately kept OUT of `src/domain` (domain-purity: no display strings). Labels are
 * for future admin surfaces only; they are NEVER authorization keys. The keys of these
 * maps are the stable domain keys — the VALUES are human-facing copy that may change
 * without any migration.
 *
 * No UI is built in this slice; these exist so the "label ≠ key" invariant is testable
 * and so the later identity-admin slice has one place to localize from.
 */

import type { JobFamilyKey, PrimaryRoleKey } from "@/domain/arena/orgIdentity";

export const JOB_FAMILY_LABELS: Readonly<Record<JobFamilyKey, string>> = {
  CLINICAL_PROVIDER: "Clinical Provider",
  CLINICAL_SUPPORT: "Clinical Support",
  FRONT_OFFICE_ADMIN: "Front Office Admin",
  OFFICE_MANAGEMENT: "Office Management",
  REGIONAL_OPERATIONS: "Regional Operations",
  ENTERPRISE_OPERATIONS: "Enterprise Operations",
  SHARED_SERVICES: "Shared Services",
};

export const PRIMARY_ROLE_LABELS: Readonly<Record<PrimaryRoleKey, string>> = {
  GENERAL_DENTIST: "General Dentist",
  ORTHODONTIST: "Orthodontist",
  DENTAL_ASSISTANT: "Dental Assistant",
  OFFICE_ADMIN: "Office Admin",
  OFFICE_MANAGER: "Office Manager",
  AREA_MANAGER: "Area Manager",
  STATE_REGIONAL_DIRECTOR: "Washington Regional Director",
  DSO_OPERATIONS_MEMBER: "DSO Operations Member",
  SSO_SUPPORT_SPECIALIST: "SSO Support Specialist",
  SSO_IT: "SSO IT",
  SSO_HR: "SSO HR",
};
