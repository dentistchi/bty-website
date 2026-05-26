"use client";

import { useState } from "react";
import { getMessages, type Locale } from "@/lib/i18n";

/** Shape returned by GET /api/arena/membership-request (subset the form needs). */
export type TeamMembershipRequest = {
  job_function: string;
  joined_at: string;
  leader_started_at: string | null;
  status: string;
  approved_at?: string | null;
};

type JobFunction = "staff" | "leader";

type Props = {
  locale: Locale;
  /** Existing request (server-fetched). null → render the submission form. */
  initialRequest: TeamMembershipRequest | null;
};

function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const CARD = "rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm";
const INPUT =
  "mt-1 w-full rounded-xl border border-[#E8E3D8] px-3 py-2.5 text-sm text-[#1E2A38] focus:outline-none focus:ring-2 focus:ring-[#1E2A38]/20 disabled:bg-[#F6F4EE] disabled:text-[#98A2B3]";

export default function TeamMembershipForm({ locale, initialRequest }: Props) {
  const t = getMessages(locale).membership;

  const [jobFunction, setJobFunction] = useState<JobFunction>("staff");
  const [joinedAt, setJoinedAt] = useState("");
  const [leaderStartedAt, setLeaderStartedAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const isLeader = jobFunction === "leader";

  // Post-submit confirmation (same session) — distinct from the persisted status view.
  if (justSubmitted) {
    return (
      <div data-testid="membership-success" className={CARD}>
        <p className="text-sm font-medium text-[#1E2A38]">{t.form.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-green-700" role="status">
          {t.form.success}
        </p>
      </div>
    );
  }

  // Existing request (pending/approved) → status, no form.
  if (initialRequest) {
    const approved = initialRequest.status === "approved";
    return (
      <div data-testid="membership-status" className={CARD}>
        <p className="text-sm font-medium text-[#1E2A38]">{t.form.title}</p>
        {approved ? (
          <p className="mt-2 text-sm leading-relaxed text-[#667085]" role="status">
            {t.status.approved}
            {initialRequest.approved_at ? (
              <span className="mt-1 block text-xs text-[#98A2B3]">
                {t.status.approvedOn} {formatDate(initialRequest.approved_at, locale)}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-[#667085]" role="status">
            {t.status.pending}
          </p>
        )}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!joinedAt) {
      setError(t.form.joinedAt.label);
      return;
    }
    if (isLeader && !leaderStartedAt) {
      setError(t.form.leaderStartedAt.hint);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/arena/membership-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          job_function: jobFunction,
          joined_at: joinedAt,
          leader_started_at: isLeader ? leaderStartedAt : null,
        }),
      });
      if (res.ok) {
        setJustSubmitted(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      setError(res.status === 400 && data.message ? data.message : t.form.errorGeneric);
    } catch {
      setError(t.form.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="membership-form" className={`${CARD} space-y-4`}>
      <div>
        <p className="text-sm font-medium text-[#1E2A38]">{t.form.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-[#667085]">{t.form.intro}</p>
      </div>

      <fieldset>
        <legend className="text-xs font-medium uppercase tracking-wide text-[#667085]">
          {t.form.jobFunction.label}
        </legend>
        <div className="mt-2 flex gap-2">
          {(["staff", "leader"] as const).map((jf) => {
            const active = jobFunction === jf;
            return (
              <label
                key={jf}
                className={`flex-1 cursor-pointer rounded-xl border px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                  active
                    ? "border-[#1E2A38] bg-[#1E2A38] text-white"
                    : "border-[#E8E3D8] bg-[#F6F4EE] text-[#1E2A38] hover:bg-[#eeeae0]"
                }`}
              >
                <input
                  type="radio"
                  name="job_function"
                  value={jf}
                  checked={active}
                  onChange={() => setJobFunction(jf)}
                  className="sr-only"
                />
                {jf === "staff" ? t.form.jobFunction.staff : t.form.jobFunction.leader}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="membership-joined-at" className="block text-xs font-medium text-[#667085]">
          {t.form.joinedAt.label}
        </label>
        <input
          id="membership-joined-at"
          type="date"
          required
          value={joinedAt}
          onChange={(e) => setJoinedAt(e.target.value)}
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="membership-leader-started-at" className="block text-xs font-medium text-[#667085]">
          {t.form.leaderStartedAt.label}
        </label>
        <input
          id="membership-leader-started-at"
          type="date"
          disabled={!isLeader}
          required={isLeader}
          value={leaderStartedAt}
          onChange={(e) => setLeaderStartedAt(e.target.value)}
          className={INPUT}
        />
        <p className="mt-1 text-xs text-[#98A2B3]">{t.form.leaderStartedAt.hint}</p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        data-testid="membership-submit"
        className="w-full rounded-xl bg-[#1E2A38] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#27384a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? t.form.submitting : t.form.submit}
      </button>
    </form>
  );
}
