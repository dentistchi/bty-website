import { NextResponse } from "next/server";

/**
 * Supabase SSR이 res.headers(특히 set-cookie)에 반영한 값을 보존한 채
 * JSON 응답을 반환하기 위한 헬퍼.
 */
export function jsonFrom(resWithCookies: NextResponse, body: unknown, status = 200) {
  const headers = new Headers(resWithCookies.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
