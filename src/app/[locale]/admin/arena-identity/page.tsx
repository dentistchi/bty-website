"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";

/**
 * Member Identity — admin curation page (Slice 3.1A-3, extends the 3.1A-2 observability
 * surface). Lists canonical organization memberships + a reconciliation summary AND lets an
 * administrator curate each member's professional identity (organization, job family,
 * primary role, role start date) through a dependent editor.
 *
 * This is identity curation for future learning routing — NOT employee evaluation, scoring,
 * or Learning Path assignment. Unknown job family / role / date is normal, never an error.
 * The UI only RENDERS options the server provides and POSTs the selected canonical IDs; all
 * authority (scope, validity, compatibility, atomicity, audit) lives on the server.
 */

type MembershipRow = {
  membershipId: string;
  displayName: string | null;
  organizationId: string;
  organizationKey: string | null;
  organizationName: string | null;
  status: string;
  isPrimary: boolean;
  jobFamilyKey: string | null;
  jobFamilyLabel: string | null;
  primaryRoleKey: string | null;
  primaryRoleLabel: string | null;
  identitySource: string;
  joinedAt: string | null;
  roleStartedOn: string | null;
  createdAt: string;
  updatedAt: string;
};

type Summary = {
  approvedRequests: number;
  activeCanonicalMemberships: number;
  approvedWithoutCanonical: number;
  canonicalWithoutApproved: number;
  unknownJobFamily: number;
  unknownPrimaryRole: number;
  fullyClassified: number;
  duplicateActivePrimary: number;
  duplicateUserOrg: number;
  unresolvedOrganization: number;
  reconciliationStatus: "aligned" | "drift";
};

type OrgOption = { id: string; organizationKey: string; displayName: string; enterpriseId: string };
type FamilyOption = { key: string; label: string };
type RoleOption = { key: string; label: string; familyKey: string };
type Taxonomy = { jobFamilies: FamilyOption[]; primaryRoles: RoleOption[] };

type ListResp = { ok?: boolean; summary?: Summary; memberships?: MembershipRow[]; error?: string };
type OptionsResp = { ok?: boolean; organizations?: OrgOption[]; taxonomy?: Taxonomy; error?: string };

type CurationStatus = "complete" | "needs_curation" | "date_unknown";

/** Presentational status only (no business rule): fully-set → complete; missing family/role
 * → needs curation; family+role set but role date unknown → date unknown. */
function curationStatus(m: MembershipRow): CurationStatus {
  if (m.jobFamilyKey == null || m.primaryRoleKey == null) return "needs_curation";
  if (m.roleStartedOn == null) return "date_unknown";
  return "complete";
}

const COPY = {
  en: {
    title: "Member Identity",
    subtitle: "Canonical organization membership and professional identity for learning routing.",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    cardApproved: "Approved Arena members",
    cardActive: "Active canonical members",
    cardUnknownFamily: "Unknown job family",
    cardUnknownRole: "Unknown primary role",
    cardStatus: "Reconciliation",
    aligned: "Canonical identity is aligned.",
    drift: "Canonical identity needs reconciliation.",
    alignedDetail: (a: number, c: number) => `${a} approved members / ${c} active canonical memberships.`,
    driftMissing: (n: number) => `${n} approved member(s) are missing canonical memberships.`,
    driftExtra: (n: number) => `${n} canonical member(s) have no approved access.`,
    driftDupPrimary: (n: number) => `${n} member(s) have more than one active primary membership.`,
    driftDupUserOrg: (n: number) => `${n} duplicate member/organization row(s).`,
    driftUnresolvedOrg: (n: number) => `${n} membership(s) reference an unresolved organization.`,
    colName: "Member",
    colOrg: "Organization",
    colState: "Identity status",
    colFamily: "Job family",
    colRole: "Primary role",
    colRoleDate: "Role since",
    colAction: "",
    notSet: "Not set",
    dateUnknownShort: "Unknown",
    active: "Active",
    inactive: "Inactive",
    primaryBadge: "Primary",
    unnamed: "Unnamed member",
    stComplete: "Complete",
    stNeeds: "Needs curation",
    stDateUnknown: "Role date unknown",
    curate: "Curate",
    loading: "Loading member identity…",
    empty: "No canonical memberships yet.",
    errorTitle: "Unable to load member identity.",
    // editor
    editTitle: "Curate professional identity",
    editIntro: "For learning routing only — not evaluation or scoring.",
    fOrg: "Primary organization",
    fFamily: "Job family",
    fRole: "Primary role",
    fRoleDate: "Role start date",
    fRoleDateHint: "When this member began the current primary role (not hire or join date).",
    dateUnknown: "Date unknown",
    unknownOption: "Unknown / not set",
    familyFirst: "Select a job family first",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Professional identity saved.",
    saveFailed: "Could not save",
    reasonInvalid: "Invalid selection.",
    reasonIncompatible: "That role does not belong to the selected job family.",
    reasonRoleReqFamily: "Choose a job family before a role.",
    reasonDateFuture: "Role start date cannot be in the future.",
    reasonDateBad: "Enter a valid date.",
    reasonScope: "This member or organization is outside your management scope.",
    reasonNotFound: "Membership no longer exists.",
    reasonNoMembership: "This member has no membership in the selected organization.",
    reasonInactiveMembership:
      "This member's membership in the selected organization is inactive. Reactivate it before curating identity.",
    reasonPrimaryConflict:
      "Another primary-membership change for this member was saved at the same time. Nothing was changed — reload and try again.",
    // leadership responsibilities (Slice 3.1B-1)
    respTitle: "Leadership responsibilities",
    respIntro:
      "Zero or more, independent of the primary role above. Identity only — this grants no access and assigns no learning.",
    respLoading: "Loading responsibilities…",
    respNone: "No leadership responsibilities assigned.",
    respSelect: "Select a responsibility…",
    respAdd: "Add responsibility",
    respRemove: "Remove",
    respFailed: "Could not update responsibilities.",
    respDuplicate: "This member already holds that responsibility.",
    respNotActive: "That responsibility is no longer assigned. Reload and try again.",
    respInvalid: "That is not a valid leadership responsibility.",
    respDateFuture: "Responsibility start date cannot be in the future.",
    respDateBad: "Enter a valid date.",
  },
  ko: {
    title: "회원 신원",
    subtitle: "학습 라우팅을 위한 표준 조직 멤버십과 직무 신원입니다.",
    refresh: "새로고침",
    refreshing: "새로고침 중…",
    cardApproved: "승인된 Arena 회원",
    cardActive: "활성 표준 회원",
    cardUnknownFamily: "직군 미설정",
    cardUnknownRole: "역할 미설정",
    cardStatus: "정합성",
    aligned: "표준 신원이 정합됩니다.",
    drift: "표준 신원에 정합 작업이 필요합니다.",
    alignedDetail: (a: number, c: number) => `승인 회원 ${a}명 / 활성 표준 멤버십 ${c}건.`,
    driftMissing: (n: number) => `승인 회원 ${n}명에 표준 멤버십이 없습니다.`,
    driftExtra: (n: number) => `표준 회원 ${n}명이 승인 접근을 갖지 않습니다.`,
    driftDupPrimary: (n: number) => `회원 ${n}명이 활성 주 멤버십을 두 개 이상 가집니다.`,
    driftDupUserOrg: (n: number) => `회원/조직 중복 행 ${n}건.`,
    driftUnresolvedOrg: (n: number) => `조직을 확인할 수 없는 멤버십 ${n}건.`,
    colName: "회원",
    colOrg: "조직",
    colState: "신원 상태",
    colFamily: "직군",
    colRole: "역할",
    colRoleDate: "역할 시작",
    colAction: "",
    notSet: "미설정",
    dateUnknownShort: "미상",
    active: "활성",
    inactive: "비활성",
    primaryBadge: "주 멤버십",
    unnamed: "이름 없는 회원",
    stComplete: "완료",
    stNeeds: "설정 필요",
    stDateUnknown: "역할 시작일 미상",
    curate: "설정",
    loading: "회원 신원을 불러오는 중…",
    empty: "아직 표준 멤버십이 없습니다.",
    errorTitle: "회원 신원을 불러오지 못했습니다.",
    // editor
    editTitle: "직무 신원 설정",
    editIntro: "학습 라우팅 전용 — 평가나 점수가 아닙니다.",
    fOrg: "주 조직",
    fFamily: "직군",
    fRole: "역할",
    fRoleDate: "역할 시작일",
    fRoleDateHint: "이 회원이 현재 주 역할을 시작한 날짜(입사일·가입일 아님).",
    dateUnknown: "날짜 미상",
    unknownOption: "미상 / 미설정",
    familyFirst: "먼저 직군을 선택하세요",
    save: "저장",
    saving: "저장 중…",
    cancel: "취소",
    saved: "직무 신원을 저장했습니다.",
    saveFailed: "저장하지 못했습니다",
    reasonInvalid: "잘못된 선택입니다.",
    reasonIncompatible: "선택한 직군에 속하지 않는 역할입니다.",
    reasonRoleReqFamily: "역할 전에 직군을 선택하세요.",
    reasonDateFuture: "역할 시작일은 미래일 수 없습니다.",
    reasonDateBad: "유효한 날짜를 입력하세요.",
    reasonScope: "관리 범위를 벗어난 회원 또는 조직입니다.",
    reasonNotFound: "멤버십이 더 이상 존재하지 않습니다.",
    reasonNoMembership: "이 회원은 선택한 조직에 멤버십이 없습니다.",
    reasonInactiveMembership:
      "선택한 조직의 멤버십이 비활성 상태입니다. 정체성을 큐레이션하기 전에 멤버십을 다시 활성화하세요.",
    reasonPrimaryConflict:
      "같은 회원의 대표 멤버십 변경이 동시에 저장되었습니다. 변경된 내용은 없습니다. 새로고침 후 다시 시도하세요.",
    // leadership responsibilities (Slice 3.1B-1)
    respTitle: "리더십 책임",
    respIntro:
      "0개 이상 지정할 수 있으며 위의 역할과 독립적입니다. 신원 정보 전용 — 접근 권한이나 학습 배정을 부여하지 않습니다.",
    respLoading: "리더십 책임을 불러오는 중…",
    respNone: "지정된 리더십 책임이 없습니다.",
    respSelect: "리더십 책임 선택…",
    respAdd: "책임 추가",
    respRemove: "제거",
    respFailed: "리더십 책임을 변경하지 못했습니다.",
    respDuplicate: "이 회원은 이미 해당 책임을 가지고 있습니다.",
    respNotActive: "해당 책임이 더 이상 지정되어 있지 않습니다. 새로고침 후 다시 시도하세요.",
    respInvalid: "유효한 리더십 책임이 아닙니다.",
    respDateFuture: "책임 시작일은 미래일 수 없습니다.",
    respDateBad: "유효한 날짜를 입력하세요.",
  },
} as const;

type Copy = (typeof COPY)[keyof typeof COPY];

function reasonMessage(reason: string | undefined, t: Copy): string {
  switch (reason) {
    case "incompatible":
      return t.reasonIncompatible;
    case "role_requires_family":
      return t.reasonRoleReqFamily;
    case "role_date_in_future":
      return t.reasonDateFuture;
    case "role_date_not_a_date":
      return t.reasonDateBad;
    case "organization_not_manageable":
    case "member_out_of_scope":
      return t.reasonScope;
    case "membership_not_found":
      return t.reasonNotFound;
    case "organization_membership_missing":
      return t.reasonNoMembership;
    case "organization_membership_inactive":
      return t.reasonInactiveMembership;
    case "primary_membership_conflict":
      return t.reasonPrimaryConflict;
    default:
      return t.reasonInvalid;
  }
}

/** Server-provided rejection reason → admin-facing copy (Slice 3.1B-1). */
function responsibilityReasonMessage(reason: string | undefined, t: Copy): string {
  switch (reason) {
    case "responsibility_already_active":
      return t.respDuplicate;
    case "responsibility_not_active":
      return t.respNotActive;
    case "invalid_responsibility":
    case "invalid_action":
      return t.respInvalid;
    case "start_date_in_future":
      return t.respDateFuture;
    case "start_date_not_a_date":
      return t.respDateBad;
    case "member_out_of_scope":
      return t.reasonScope;
    case "membership_not_found":
      return t.reasonNotFound;
    case "organization_membership_inactive":
      return t.reasonInactiveMembership;
    default:
      return t.respFailed;
  }
}

export default function AdminArenaIdentityPage() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en") as "en" | "ko";
  const t = COPY[locale];

  const [summary, setSummary] = useState<Summary | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MembershipRow | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listR, optR] = await Promise.all([
        fetch("/api/admin/arena/org-memberships", { credentials: "include" }),
        fetch("/api/admin/arena/org-memberships/curate", { credentials: "include" }),
      ]);
      const list: ListResp = await listR.json().catch(() => ({}));
      const opt: OptionsResp = await optR.json().catch(() => ({}));
      if (!listR.ok || !list.ok) {
        setError(list.error ?? `HTTP ${listR.status}`);
        setSummary(null);
        setMemberships([]);
        return;
      }
      setSummary(list.summary ?? null);
      setMemberships(Array.isArray(list.memberships) ? list.memberships : []);
      if (optR.ok && opt.ok) {
        setOrgs(Array.isArray(opt.organizations) ? opt.organizations : []);
        setTaxonomy(opt.taxonomy ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSaved = useCallback(async () => {
    setEditing(null);
    setSavedFlash(true);
    await load();
    setTimeout(() => setSavedFlash(false), 3000);
  }, [load]);

  const statusLabel = (s: CurationStatus): string =>
    s === "complete" ? t.stComplete : s === "date_unknown" ? t.stDateUnknown : t.stNeeds;
  const statusCls = (s: CurationStatus): string =>
    s === "complete"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : s === "date_unknown"
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  const canEdit = taxonomy != null && orgs.length > 0;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8" data-testid="admin-arena-identity">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{t.title}</h1>
          <p className="mt-1 text-sm text-neutral-600">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          data-testid="identity-refresh"
          className="shrink-0 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-neutral-700"
        >
          {loading ? t.refreshing : t.refresh}
        </button>
      </div>

      {savedFlash && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" data-testid="identity-saved">
          {t.saved}
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500" data-testid="identity-loading">{t.loading}</p>}

      {error && !loading && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700" data-testid="identity-error">
          {t.errorTitle} <span className="text-red-500">({error})</span>
        </div>
      )}

      {!loading && !error && summary && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="identity-summary">
            <SummaryCard label={t.cardApproved} value={summary.approvedRequests} />
            <SummaryCard label={t.cardActive} value={summary.activeCanonicalMemberships} />
            <SummaryCard label={t.cardUnknownFamily} value={summary.unknownJobFamily} />
            <SummaryCard label={t.cardUnknownRole} value={summary.unknownPrimaryRole} />
            <SummaryCard
              label={t.cardStatus}
              value={summary.reconciliationStatus === "aligned" ? "✓" : "!"}
              tone={summary.reconciliationStatus === "aligned" ? "ok" : "warn"}
            />
          </div>

          {summary.reconciliationStatus === "aligned" ? (
            <div className="mb-6 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" data-testid="identity-banner-aligned">
              <span className="font-medium">{t.aligned}</span>{" "}
              {t.alignedDetail(summary.approvedRequests, summary.activeCanonicalMemberships)}
            </div>
          ) : (
            <div className="mb-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-testid="identity-banner-drift">
              <span className="font-medium">{t.drift}</span>
              <ul className="mt-1 list-disc pl-5">
                {summary.approvedWithoutCanonical > 0 && <li>{t.driftMissing(summary.approvedWithoutCanonical)}</li>}
                {summary.canonicalWithoutApproved > 0 && <li>{t.driftExtra(summary.canonicalWithoutApproved)}</li>}
                {summary.duplicateActivePrimary > 0 && <li>{t.driftDupPrimary(summary.duplicateActivePrimary)}</li>}
                {summary.duplicateUserOrg > 0 && <li>{t.driftDupUserOrg(summary.duplicateUserOrg)}</li>}
                {summary.unresolvedOrganization > 0 && <li>{t.driftUnresolvedOrg(summary.unresolvedOrganization)}</li>}
              </ul>
            </div>
          )}

          {memberships.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-white p-6 text-sm text-neutral-500" data-testid="identity-empty">
              {t.empty}
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-neutral-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="p-3 font-medium">{t.colName}</th>
                    <th className="p-3 font-medium">{t.colOrg}</th>
                    <th className="p-3 font-medium">{t.colState}</th>
                    <th className="p-3 font-medium">{t.colFamily}</th>
                    <th className="p-3 font-medium">{t.colRole}</th>
                    <th className="p-3 font-medium">{t.colRoleDate}</th>
                    <th className="p-3 font-medium">{t.colAction}</th>
                  </tr>
                </thead>
                <tbody data-testid="identity-rows">
                  {memberships.map((m) => {
                    const st = curationStatus(m);
                    return (
                      <tr key={m.membershipId} className="border-b border-neutral-100">
                        <td className="p-3">{m.displayName ?? <span className="text-neutral-400">{t.unnamed}</span>}</td>
                        <td className="p-3">{m.organizationName ?? "—"}</td>
                        <td className="p-3">
                          <span
                            data-testid={`status-${m.membershipId}`}
                            className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${statusCls(st)}`}
                          >
                            {statusLabel(st)}
                          </span>
                        </td>
                        <td className="p-3">
                          {m.jobFamilyLabel ?? <span className="text-neutral-400" data-testid="family-not-set">{t.notSet}</span>}
                        </td>
                        <td className="p-3">
                          {m.primaryRoleLabel ?? <span className="text-neutral-400" data-testid="role-not-set">{t.notSet}</span>}
                        </td>
                        <td className="p-3 text-neutral-600">
                          {m.roleStartedOn ? m.roleStartedOn.slice(0, 10) : <span className="text-neutral-400">{t.dateUnknownShort}</span>}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setEditing(m)}
                            data-testid={`curate-${m.membershipId}`}
                            className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                          >
                            {t.curate}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && taxonomy && (
        <IdentityEditor
          key={editing.membershipId}
          member={editing}
          orgs={orgs}
          taxonomy={taxonomy}
          t={t}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" }) {
  const toneCls = tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-neutral-900";
  return (
    <div className="rounded border border-neutral-200 bg-white p-3 shadow-sm">
      <div className={`text-2xl font-semibold ${toneCls}`}>{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function IdentityEditor({
  member,
  orgs,
  taxonomy,
  t,
  onClose,
  onSaved,
}: {
  member: MembershipRow;
  orgs: OrgOption[];
  taxonomy: Taxonomy;
  t: Copy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [orgId, setOrgId] = useState<string>(member.organizationId);
  const [family, setFamily] = useState<string>(member.jobFamilyKey ?? "");
  const [role, setRole] = useState<string>(member.primaryRoleKey ?? "");
  const initialDate = member.roleStartedOn ? member.roleStartedOn.slice(0, 10) : "";
  const [dateUnknown, setDateUnknown] = useState<boolean>(member.roleStartedOn == null);
  const [roleDate, setRoleDate] = useState<string>(initialDate);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Roles allowed for the currently-selected family (canonical role→family from the server).
  const roleOptions = useMemo(
    () => (family ? taxonomy.primaryRoles.filter((r) => r.familyKey === family) : []),
    [family, taxonomy.primaryRoles],
  );

  // Changing the family invalidates a role that no longer belongs to it — never silently kept.
  const onFamilyChange = (next: string) => {
    setFamily(next);
    if (!next) {
      setRole("");
      return;
    }
    if (role && !taxonomy.primaryRoles.some((r) => r.key === role && r.familyKey === next)) {
      setRole("");
    }
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/arena/org-memberships/curate", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          membershipId: member.membershipId,
          organizationId: orgId,
          jobFamilyKey: family || null,
          primaryRoleKey: role || null,
          roleStartedOn: dateUnknown || !roleDate ? null : roleDate,
        }),
      });
      const data: { ok?: boolean; reason?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErr(reasonMessage(data.reason, t));
        return;
      }
      onSaved();
    } catch {
      setErr(t.reasonInvalid);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="identity-editor"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">{t.editTitle}</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="close">
            ✕
          </button>
        </div>
        <p className="mb-1 text-xs text-neutral-500">{member.displayName ?? t.unnamed}</p>
        <p className="mb-4 text-xs text-neutral-400">{t.editIntro}</p>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.fOrg}</span>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            data-testid="editor-org"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.fFamily}</span>
          <select
            value={family}
            onChange={(e) => onFamilyChange(e.target.value)}
            data-testid="editor-family"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t.unknownOption}</option>
            {taxonomy.jobFamilies.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.fRole}</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={!family}
            data-testid="editor-role"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-100"
          >
            <option value="">{family ? t.unknownOption : t.familyFirst}</option>
            {roleOptions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-4">
          <span className="mb-1 block text-sm font-medium text-neutral-700">{t.fRoleDate}</span>
          <input
            type="date"
            value={roleDate}
            max={today}
            disabled={dateUnknown}
            onChange={(e) => setRoleDate(e.target.value)}
            data-testid="editor-date"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-100"
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={dateUnknown}
              onChange={(e) => setDateUnknown(e.target.checked)}
              data-testid="editor-date-unknown"
            />
            {t.dateUnknown}
          </label>
          <p className="mt-1 text-xs text-neutral-400">{t.fRoleDateHint}</p>
        </div>

        {/*
          Leadership responsibilities — a SEPARATE 0..n dimension, deliberately not merged
          with Primary Role. Each add/remove/date-revision commits on its own to the
          responsibilities endpoint, so nothing is ever assigned silently as a side effect
          of the identity Save above.
        */}
        <ResponsibilitiesSection membershipId={member.membershipId} locale={t === COPY.ko ? "ko" : "en"} t={t} />

        {err && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700" data-testid="editor-error">
            {t.saveFailed}: {err}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            data-testid="editor-save"
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

type ResponsibilityRow = { id: string; responsibilityKey: string; startedOn: string | null };
type VocabularyItem = { key: string; label: string };

/**
 * Leadership responsibilities sub-editor (Slice 3.1B-1).
 *
 * Render-only with respect to business rules: the canonical vocabulary, validity, and
 * every rejection reason come from the server. Zero or more responsibilities per
 * membership; each mutation is an explicit, individually-committed admin action.
 */
function ResponsibilitiesSection({
  membershipId,
  locale,
  t,
}: {
  membershipId: string;
  locale: "en" | "ko";
  t: Copy;
}) {
  const [rows, setRows] = useState<ResponsibilityRow[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rErr, setRErr] = useState<string | null>(null);

  const [addKey, setAddKey] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addDateUnknown, setAddDateUnknown] = useState(true);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/arena/org-memberships/responsibilities?membershipId=${encodeURIComponent(membershipId)}&locale=${locale}`,
        { credentials: "include", cache: "no-store" },
      );
      const data: { ok?: boolean; responsibilities?: ResponsibilityRow[]; vocabulary?: VocabularyItem[] } =
        await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setRows(data.responsibilities ?? []);
        setVocabulary(data.vocabulary ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [membershipId, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (body: Record<string, unknown>) => {
    setBusy(true);
    setRErr(null);
    try {
      const res = await fetch("/api/admin/arena/org-memberships/responsibilities", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ membershipId, ...body }),
      });
      const data: { ok?: boolean; reason?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setRErr(responsibilityReasonMessage(data.reason, t));
        return false;
      }
      await load();
      return true;
    } catch {
      setRErr(t.respFailed);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Only offer keys not already active — the server rejects duplicates regardless.
  const assigned = new Set(rows.map((r) => r.responsibilityKey));
  const available = vocabulary.filter((v) => !assigned.has(v.key));

  return (
    <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3" data-testid="responsibilities-section">
      <h3 className="mb-1 text-sm font-semibold text-neutral-900">{t.respTitle}</h3>
      <p className="mb-3 text-xs text-neutral-500">{t.respIntro}</p>

      {loading ? (
        <p className="text-xs text-neutral-400">{t.respLoading}</p>
      ) : rows.length === 0 ? (
        <p className="mb-3 text-xs text-neutral-400" data-testid="responsibilities-empty">
          {t.respNone}
        </p>
      ) : (
        <ul className="mb-3 space-y-1" data-testid="responsibilities-list">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded border border-neutral-200 bg-white px-2 py-1.5"
              data-testid={`responsibility-${r.responsibilityKey}`}
            >
              <span className="text-sm text-neutral-800">
                {vocabulary.find((v) => v.key === r.responsibilityKey)?.label ?? r.responsibilityKey}
                <span className="ml-2 text-xs text-neutral-400">{r.startedOn ?? t.dateUnknown}</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void mutate({ responsibilityKey: r.responsibilityKey, action: "remove" })}
                data-testid={`responsibility-remove-${r.responsibilityKey}`}
                className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
              >
                {t.respRemove}
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="rounded border border-dashed border-neutral-300 bg-white p-2">
          <select
            value={addKey}
            onChange={(e) => setAddKey(e.target.value)}
            data-testid="responsibility-add-select"
            className="mb-2 w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t.respSelect}</option>
            {available.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={addDate}
            max={today}
            disabled={addDateUnknown}
            onChange={(e) => setAddDate(e.target.value)}
            data-testid="responsibility-add-date"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm disabled:bg-neutral-100"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={addDateUnknown}
              onChange={(e) => setAddDateUnknown(e.target.checked)}
              data-testid="responsibility-add-date-unknown"
            />
            {t.dateUnknown}
          </label>
          <button
            type="button"
            disabled={busy || !addKey}
            onClick={async () => {
              const ok = await mutate({
                responsibilityKey: addKey,
                action: "assign",
                startedOn: addDateUnknown || !addDate ? null : addDate,
              });
              if (ok) {
                setAddKey("");
                setAddDate("");
                setAddDateUnknown(true);
              }
            }}
            data-testid="responsibility-add"
            className="mt-2 w-full rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {t.respAdd}
          </button>
        </div>
      )}

      {rErr && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700" data-testid="responsibility-error">
          {rErr}
        </div>
      )}
    </div>
  );
}
