"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { getLocaleFromPathname } from "@/lib/locale";
import { t } from "@/lib/i18n/train";
import { dayStatus } from "@/lib/trainLock";

type Progress = {
  startDateISO: string;
  lastCompletedDay: number;
  lastCompletedAt: string | null;
};

export default function TrainSidebar({
  userEmail,
  progress,
  onRefresh,
  onMarkCompleteSuccess,
}: {
  userEmail: string;
  progress: Progress;
  onRefresh: () => Promise<void>;
  onMarkCompleteSuccess?: () => void;
}) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const currentDay = useMemo(() => {
    const m = pathname.match(/\/train\/day\/(\d+)/);
    return m ? Number(m[1]) : 1;
  }, [pathname]);

  async function markComplete() {
    setBusy(true);
    setToast(null);
    const r = await fetch("/api/train/progress", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: currentDay }),
    }).then((x) => x.json());

    if (!r?.ok) {
      setToast(r?.error ?? "Failed");
      setBusy(false);
      return;
    }
    await onRefresh();
    onMarkCompleteSuccess?.();
    setBusy(false);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="text-sm font-semibold">{t(locale, "trackTitle")}</div>
        <div className="text-xs text-gray-500 mt-1">{t(locale, "user")}: {userEmail}</div>
        <div className="mt-3">
          <button
            onClick={markComplete}
            disabled={busy}
            className="w-full rounded-lg px-3 py-2 text-sm bg-black text-white disabled:opacity-50"
          >
            {busy ? t(locale, "processing") : t(locale, "markComplete")}
          </button>
        </div>
        {toast && (
          <div className="mt-2 text-xs text-red-600" role="alert">
            {toast}
          </div>
        )}
        <div className="text-[11px] text-gray-500 mt-2">
          {t(locale, "ruleNote")}
        </div>
      </div>

      <div className="p-3 grid grid-cols-2 gap-2 overflow-auto">
        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => {
          const st = dayStatus(day, progress, new Date());

          const label =
            st === "done" ? "✔" : st === "today" ? "✅" : "🔒";
          const statusText =
            st === "done" ? t(locale, "done") : st === "today" ? t(locale, "today") : t(locale, "locked");

          const disabled = st === "locked";
          const isActive = day === currentDay;

          return (
            <Link
              key={day}
              href={disabled ? "#" : `/train/day/${day}`}
              onClick={(e) => disabled && e.preventDefault()}
              className={[
                "rounded-lg border px-3 py-2 text-sm flex items-center justify-between",
                disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "bg-white hover:bg-gray-50",
                isActive ? "border-black" : "border-gray-200",
              ].join(" ")}
            >
              <span>Day {day}</span>
              <span title={statusText}>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
