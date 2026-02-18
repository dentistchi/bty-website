"use client";

import { useEffect, useState } from "react";

export default function ReflectionBox({
  day,
  title,
  placeholder,
  saveLabel,
}: {
  day: number;
  title: string;
  placeholder: string;
  saveLabel: string;
}) {
  const key = `train:day:${day}:reflection`;
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setText(saved);
    } catch {}
  }, [key]);

  const save = () => {
    try {
      localStorage.setItem(key, text);
    } catch {}
  };

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm font-semibold">{title}</div>
      <textarea
        className="mt-3 w-full rounded-lg border p-3 text-sm min-h-[120px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
      />
      <div className="mt-2 flex justify-end">
        <button className="px-3 py-2 rounded-lg border text-sm" onClick={save}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
