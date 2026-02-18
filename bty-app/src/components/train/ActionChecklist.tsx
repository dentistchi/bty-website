"use client";

import { useEffect, useMemo, useState } from "react";

export default function ActionChecklist({
  day,
  items,
  title,
}: {
  day: number;
  items: string[];
  title: string;
}) {
  const key = `train:day:${day}:checks`;
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setChecked(JSON.parse(saved));
    } catch {}
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(checked));
    } catch {}
  }, [key, checked]);

  const doneCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );

  if (!items.length) return null;

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-gray-500">
          {doneCount}/{items.length}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((it, idx) => (
          <label key={idx} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={!!checked[idx]}
              onChange={(e) =>
                setChecked((prev) => ({ ...prev, [idx]: e.target.checked }))
              }
            />
            <span className="leading-6">{it}</span>
          </label>
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        These are "micro-actions." Completing even one counts.
      </div>
    </div>
  );
}
