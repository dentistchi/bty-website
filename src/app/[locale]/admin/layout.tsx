import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServerReadonly } from "@/lib/supabase-server-readonly";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isActivePlatformAdmin } from "@/lib/bty/authority/platformAdmin.server";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
  ★ THE ADMIN SURFACE IS GATED BY A GRANT, NOT BY AN EMAIL (2026-09-02).

  This page previously carried its own copy of the `BTY_ADMIN_EMAILS` allowlist, with the same
  fail-OPEN branch the API layer had: an empty or unset variable admitted EVERY authenticated user
  to the entire admin console. Both halves are gone. Authority is now the canonical
  `bty_platform_admin_grants` row, resolved from the session's canonical user id.
*/
type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;
  const base = `/${locale}/admin`;

  // Admin auth is OAuth-only via /bty/login. We must NOT redirect to
  // `${base}/login`: that route is itself under this layout, so a logged-out
  // user would be redirected to a page that re-runs this gate → infinite loop
  // (#19). Send no-session users to the working OAuth login instead.
  const supabase = await getSupabaseServerReadonly();
  if (!supabase) {
    redirect(`/${locale}/bty/login`);
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/${locale}/bty/login?next=${encodeURIComponent(base)}`);
  }

  // Fail closed on every uncertainty, including a missing admin client: an admin console that
  // cannot check authority has not established that anyone is an admin.
  const admin = getSupabaseAdmin();
  if (!admin || !(await isActivePlatformAdmin(admin, data.user.id))) {
    // Authenticated but not an admin → access denied page (not /admin/login,
    // which would re-loop this gate). Same #19 loop class.
    redirect(`/${locale}/forbidden`);
  }

  return (
    <>
      <AdminNav locale={locale} />
      <div className="pt-12">{children}</div>
    </>
  );
}
