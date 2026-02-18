"use client";

import { useEffect, useMemo, useState } from "react";

export default function FocusTimer({
  minutes = 10,
  labels,
}: {
  minutes?: number;
  labels: { start: string; stop: string; reset: string };
}) {
  const total = minutes * 60;
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(total);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (sec === 0) setRunning(false);
  }, [sec]);

  const mmss = useMemo(() => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }, [sec]);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm font-semibold">Focus</div>
      <div className="mt-2 text-3xl font-mono">{mmss}</div>
      <div className="mt-3 flex gap-2">
        {!running ? (
          <button
            className="px-3 py-2 rounded-lg bg-black text-white text-sm"
            onClick={() => setRunning(true)}
            disabled={sec === 0}
          >
            {labels.start}
          </button>
        ) : (
          <button
            className="px-3 py-2 rounded-lg border text-sm"
            onClick={() => setRunning(false)}
          >
            {labels.stop}
          </button>
        )}

        <button
          className="px-3 py-2 rounded-lg border text-sm"
          onClick={() => {
            setRunning(false);
            setSec(total);
          }}
        >
          {labels.reset}
        </button>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Tip: start small. 10 minutes is enough to win today.
      </div>
    </div>
  );
}
