"use client";

import { usePathname } from "next/navigation";
import LoginClient from "./LoginClient";

export function LoginLocaleWrapper({ nextPath }: { nextPath: string }) {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  return <LoginClient nextPath={nextPath} locale={locale} />;
}
