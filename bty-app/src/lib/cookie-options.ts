export type CookieOptionsLike = Record<string, unknown> & {
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
};

export function forceCookieOptions(
  options: CookieOptionsLike | undefined,
  ctx: { isHttps: boolean }
): Record<string, unknown> {
  // 1) options를 먼저 깔고
  // 2) 우리가 마지막에 강제값을 다시 덮어써서 "절대 안 흔들리게" 만든다
  return {
    ...(options ?? {}),
    path: "/",
    sameSite: "lax" as const,
    secure: ctx.isHttps, // prod(https)에서는 true, dev(http)에서는 false
    httpOnly: true,
  };
}
