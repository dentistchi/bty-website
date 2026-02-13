"use client";

import { useState } from "react";
import type { PatchReport } from "./types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  applied: "bg-blue-100 text-blue-800",
};

function StatusChip({ status }: { status?: string }) {
  const s = (status ?? "draft").toLowerCase();
  const cls = STATUS_COLORS[s] ?? "bg-neutral-100 text-neutral-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {s}
    </span>
  );
}

export function PatchReportsCard({
  patches,
  loading,
  onRefresh,
}: {
  patches: PatchReport[];
  loading: boolean;
  onRefresh?: () => void;
}) {
  const [modalPatch, setModalPatch] = useState<PatchReport | null>(null);

  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-neutral-800">
          Latest Patch Reports
        </h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-neutral-800">
          Latest Patch Reports
        </h3>
        {patches.length ? (
          <div className="space-y-2">
            {patches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setModalPatch(p)}
                className="flex w-full items-center justify-between rounded-lg border border-neutral-200 p-3 text-left transition hover:bg-neutral-50"
              >
                <div className="min-w-0 flex-1">
                  <code className="text-xs text-neutral-500">{p.id.slice(0, 8)}…</code>
                  <p className="mt-0.5 truncate text-sm text-neutral-700">
                    {p.summary || "No summary"}
                  </p>
                  <span className="mt-1 inline-block text-xs text-neutral-400">
                    {p.window_days}d · {new Date(p.created_at).toLocaleString()}
                  </span>
                </div>
                <StatusChip status={p.status} />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No patch reports yet</p>
        )}
      </div>

      {modalPatch && (
        <PatchReportModal
          patch={modalPatch}
          onClose={() => setModalPatch(null)}
          onApply={async () => {
            const res = await fetch(`/api/admin/patch/apply?id=${encodeURIComponent(modalPatch.id)}`, {
              method: "POST",
              credentials: "include",
            });
            if (res.ok && onRefresh) {
              onRefresh();
              setModalPatch(null);
            }
          }}
        />
      )}
    </>
  );
}

function PatchReportModal({
  patch,
  onClose,
  onApply,
}: {
  patch: PatchReport;
  onClose: () => void;
  onApply?: () => Promise<void>;
}) {
  const [applying, setApplying] = useState(false);
  const isDraft = (patch.status ?? "draft").toLowerCase() === "draft";
  const report = patch.report;
  const rules = report?.rule_patches ?? (report as { top_patterns?: Array<{ suggested_patch?: string }> })?.top_patterns ?? [];
  const tests = report?.tests ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-800">
            Patch Report · {patch.id.slice(0, 8)}…
          </h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {patch.window_days}d · {new Date(patch.created_at).toLocaleString()}
        </p>

        {isDraft && onApply && (
          <div className="mt-4">
            <button
              type="button"
              onClick={async () => {
                setApplying(true);
                try {
                  await onApply();
                } finally {
                  setApplying(false);
                }
              }}
              disabled={applying}
              className="rounded bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply patch"}
            </button>
            <p className="mt-1 text-xs text-neutral-500">
              Sets status to applied and reloads runtime config.
            </p>
          </div>
        )}

        <section className="mt-4">
          <h4 className="text-sm font-medium text-neutral-600">Summary</h4>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-neutral-50 p-3 text-xs text-neutral-700">
            {patch.summary || "—"}
          </pre>
        </section>

        {Array.isArray(rules) && rules.length > 0 && (
          <section className="mt-4">
            <h4 className="text-sm font-medium text-neutral-600">Suggested rules</h4>
            <div className="mt-1 space-y-2">
              {rules.map((r, i) => (
                <div key={i} className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
                  {typeof r === "object" && r !== null && "change" in r ? (
                    <>
                      <p className="font-medium text-neutral-700">
                        {(r as { target_issue?: string }).target_issue ?? "—"}
                      </p>
                      <p className="mt-1 text-neutral-600">
                        {(r as { change?: string }).change}
                      </p>
                      {(r as { implementation?: { file: string } }).implementation && (
                        <p className="mt-1 text-xs text-neutral-500">
                          file: {(r as { implementation?: { file: string } }).implementation?.file}
                        </p>
                      )}
                    </>
                  ) : (
                    <p>{(r as { suggested_patch?: string }).suggested_patch ?? JSON.stringify(r)}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {tests.length > 0 && (
          <section className="mt-4">
            <h4 className="text-sm font-medium text-neutral-600">Tests</h4>
            <div className="mt-1 space-y-2">
              {tests.map((t, i) => (
                <div key={i} className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm">
                  <p className="font-medium">{t.name}</p>
                  <p className="mt-1 text-neutral-600">Given: {t.given}</p>
                  <p className="mt-0.5 text-neutral-600">Expect: {t.expect}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-4">
          <h4 className="text-sm font-medium text-neutral-600">JSON</h4>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-neutral-900 p-3 text-xs text-neutral-300">
            {JSON.stringify(patch, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}
