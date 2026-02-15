import type { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isAdminRole } from "@/lib/roles";

type Ok = { user: { id: string; email?: string | null } };
type Err = { error: "Unauthorized" | "Forbidden" | "Server not configured"; status: number };

export async function requireAdmin(request: NextRequest): Promise<Ok | Err> {
  const supabase = getSupabaseServer(request);
  if (!supabase) {
    return { error: "Server not configured", status: 503 };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: "Unauthorized", status: 401 };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { error: "Server not configured", status: 503 };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !isAdminRole(profile.role)) {
    return { error: "Forbidden", status: 403 };
  }

  return { user: { id: user.id, email: user.email } };
}
