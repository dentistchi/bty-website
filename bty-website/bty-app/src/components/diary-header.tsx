"use client";

import { useState, useEffect } from "react";

/**
 * 날짜는 클라이언트에서만 포맷해 표시해, 서버/클라이언트 타임존 차이로 인한
 * hydration mismatch를 방지합니다.
 */
function useClientDateString(locale = "ko-KR") {
  const [dateString, setDateString] = useState("");
  useEffect(() => {
    const now = new Date();
    setDateString(
      now.toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      })
    );
  }, [locale]);
  return dateString;
}

export function DiaryHeader() {
  const dateString = useClientDateString();

  return (
    <header className="flex items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-dojo-ink-soft" suppressHydrationWarning>
          {dateString}
        </span>
      </div>
    </header>
  );
}
