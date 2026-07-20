"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

/**
 * Member Identity — admin observability page (Slice 3.1A-2).
 *
 * READ-ONLY. Shows canonical organization memberships + a reconciliation summary. There
 * are deliberately NO edit/save/status/curation controls in this slice. Copy is inlined
 * (en/ko) since this is an internal admin surface; architecture jargon is kept out of the
 * primary copy. Unknown job family / primary role is normal state, not an error.
 */

type MembershipRow = {
  membershipId: string;
  displayName: string | null;
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
  roleStartedAt: string | null;
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

type Resp = { ok?: boolean; summary?: Summary; memberships?: MembershipRow[]; error?: string };

const COPY = {
  en: {
    title: "Member Identity",
    subtitle: "Canonical organization membership and professional identity readiness.",
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
    colStatus: "Status",
    colFamily: "Job family",
    colRole: "Primary role",
    colSource: "Identity source",
    colJoined: "Joined",
    notSet: "Not set",
    active: "Active",
    inactive: "Inactive",
    primaryBadge: "Primary",
    unnamed: "Unnamed member",
    sourceLegacy: "Migrated from existing Arena approval",
    sourceApproval: "Created during member approval",
    sourceCurated: "Updated by administrator",
    loading: "Loading member identity…",
    empty: "No canonical memberships yet.",
    errorTitle: "Unable to load member identity.",
    inspectLink: "Member Identity",
  },
  ko: {
    title: "회원 신원",
    subtitle: "표준 조직 멤버십과 직무 신원 준비 상태입니다.",
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
    colStatus: "상태",
    colFamily: "직군",
    colRole: "역할",
    colSource: "신원 출처",
    colJoined: "가입일",
    notSet: "미설정",
    active: "활성",
    inactive: "비활성",
    primaryBadge: "주 멤버십",
    unnamed: "이름 없는 회원",
    sourceLegacy: "기존 Arena 승인에서 이전됨",
    sourceApproval: "회원 승인 시 생성됨",
    sourceCurated: "관리자가 업데이트함",
    loading: "회원 신원을 불러오는 중…",
    empty: "아직 표준 멤버십이 없습니다.",
    errorTitle: "회원 신원을 불러오지 못했습니다.",
    inspectLink: "회원 신원",
  },
} as const;

export default function AdminArenaIdentityPage() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" && params.locale === "ko" ? "ko" : "en") as "en" | "ko";
  const t = COPY[locale];

  const [summary, setSummary] = useState<Summary | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/arena/org-memberships", { credentials: "include" });
      const data: Resp = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setError(data.error ?? `HTTP ${r.status}`);
        setSummary(null);
        setMemberships([]);
        return;
      }
      setSummary(data.summary ?? null);
      setMemberships(Array.isArray(data.memberships) ? data.memberships : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sourceLabel = (src: string): string =>
    src === "membership_approval" ? t.sourceApproval : src === "admin_curated" ? t.sourceCurated : t.sourceLegacy;

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
                    <th className="p-3 font-medium">{t.colStatus}</th>
                    <th className="p-3 font-medium">{t.colFamily}</th>
                    <th className="p-3 font-medium">{t.colRole}</th>
                    <th className="p-3 font-medium">{t.colSource}</th>
                    <th className="p-3 font-medium">{t.colJoined}</th>
                  </tr>
                </thead>
                <tbody data-testid="identity-rows">
                  {memberships.map((m) => (
                    <tr key={m.membershipId} className="border-b border-neutral-100">
                      <td className="p-3">{m.displayName ?? <span className="text-neutral-400">{t.unnamed}</span>}</td>
                      <td className="p-3">{m.organizationName ?? "—"}</td>
                      <td className="p-3">
                        <span className="text-neutral-700">{m.status === "active" ? t.active : t.inactive}</span>
                        {m.isPrimary && (
                          <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
                            {t.primaryBadge}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {m.jobFamilyLabel ?? <span className="text-neutral-400" data-testid="family-not-set">{t.notSet}</span>}
                      </td>
                      <td className="p-3">
                        {m.primaryRoleLabel ?? <span className="text-neutral-400" data-testid="role-not-set">{t.notSet}</span>}
                      </td>
                      <td className="p-3 text-neutral-600">{sourceLabel(m.identitySource)}</td>
                      <td className="p-3 text-neutral-600">{m.joinedAt ? m.joinedAt.slice(0, 10) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
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
