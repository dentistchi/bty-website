"use client";

import { useEffect } from "react";

export function ThemeBody({ theme }: { theme: "sanctuary" | "dojo" }) {
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    return () => document.body.removeAttribute("data-theme");
  }, [theme]);
  return null;
}
