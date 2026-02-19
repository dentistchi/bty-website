import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServerReadonly } from "@/lib/supabase-server-readonly";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BtyLayout({ children }: { children: ReactNode }) {
  const supabase = await getSupabaseServerReadonly();
  if (!supabase) {
    redirect("/bty/login");
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect(`/bty/login?next=${encodeURIComponent("/bty")}`);
  }

  return <>{children}</>;
}
