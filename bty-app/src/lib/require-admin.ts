import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isAdminRole } from "@/lib/roles";

export async function requireAdmin(request: Request) {
  const supabase = createServerSupabaseClient();

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { error: "Unauthorized", status: 401 };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !isAdminRole(profile.role)) {
    return { error: "Forbidden", status: 403 };
  }

  return { user };
}
