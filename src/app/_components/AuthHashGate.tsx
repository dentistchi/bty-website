"use client";

import { useEffect } from "react";

export default function AuthHashGate() {
  useEffect(() => {
    const hash = window.location.hash || "";

    // ✅ hash 없으면 아무것도 하지 않음 (중요)
    if (!hash) return;

    // hash가 있는 경우에만 (recovery / callback) 처리
    // 여기서만 세션 세팅/리다이렉트 수행
  }, []);

  return null;
}
