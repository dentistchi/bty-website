export type Locale = "en" | "ko";

export function getLocaleFromPathname(pathname: string): Locale {
  // 예: /en/train/day/1 -> en
  //     /train/day/1 -> en (기본)
  //     /ko/... 확장 가능
  if (pathname.startsWith("/ko/") || pathname === "/ko") return "ko";
  if (pathname.startsWith("/en/") || pathname === "/en") return "en";
  return "en";
}
