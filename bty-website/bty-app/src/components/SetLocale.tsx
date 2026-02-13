"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function SetLocale() {
  const pathname = usePathname() ?? "";
  useEffect(() => {
    document.documentElement.lang = pathname.startsWith("/en") ? "en" : "ko";
  }, [pathname]);
  return null;
}
