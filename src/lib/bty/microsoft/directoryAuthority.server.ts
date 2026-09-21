import type { SupabaseClient } from "@supabase/supabase-js";
import { getGraphAppToken, graphConfigFromEnv, listDirectoryUsers, probeDirectReports } from "./graphDirectory.server";
import { classifyMicrosoftProfessionalAuthority } from "./professionalAuthority";

export type DirectorySyncResult = { ok: boolean; total: number; activeMembers: number; disabled: number; guests: number; providers: number; managers: number; overlap: number; nonAuthors: number; indeterminate: number };
const empty = (): DirectorySyncResult => ({ ok:false,total:0,activeMembers:0,disabled:0,guests:0,providers:0,managers:0,overlap:0,nonAuthors:0,indeterminate:0 });

/** Bounded full sync: scans Entra, never auth.users, and stores no roster PII. */
export async function syncMicrosoftDirectoryAuthority(admin: SupabaseClient): Promise<DirectorySyncResult> {
  const config = graphConfigFromEnv(); if (!config) return empty();
  const token = await getGraphAppToken(config); if (!token) return empty();
  const listed = await listDirectoryUsers(token); if (!listed.ok) return empty();
  let activeMembers=0,disabled=0,guests=0,providers=0,managers=0,overlap=0,nonAuthors=0,indeterminate=0;
  for (const user of listed.users) {
    const active = user.accountEnabled && user.userType.toLowerCase()==="member";
    if (!user.accountEnabled) disabled++; if (user.userType.toLowerCase()!=="member") guests++; if (active) activeMembers++;
    const reports = active ? await probeDirectReports(token,user.id) : { ok:true,hasDirectReports:false };
    if (!reports.ok) { indeterminate++; continue; }
    const role=classifyMicrosoftProfessionalAuthority(user.jobTitle,user.employeeType);
    const isProvider=active && role.isProvider, isManager=active && (role.isManager || reports.hasDirectReports);
    if(isProvider) providers++; if(isManager) managers++; if(isProvider&&isManager) overlap++; if(active&&!isProvider&&!isManager) nonAuthors++;
    const { error } = await admin.from("bty_microsoft_directory_authority").upsert({
      tenant_id:config.tenantId,aad_object_id:user.id,account_enabled:user.accountEnabled,user_type:user.userType,job_title:user.jobTitle,employee_type:user.employeeType,is_provider:isProvider,is_manager:isManager,sync_status:"success",last_seen_at:new Date().toISOString(),synced_at:new Date().toISOString(),updated_at:new Date().toISOString()
    },{onConflict:"tenant_id,aad_object_id"});
    if(error) indeterminate++;
  }
  // Existing BTY identities are merely links onto directory principals; they never bound the scan.
  const { data: linked } = await admin.rpc("bty_list_microsoft_linked_users");
  for (const identity of (Array.isArray(linked) ? linked : []) as Array<{ user_id: string; tenant_id: string; aad_object_id: string }>) {
    await bindDirectoryAuthorityUser(admin, identity.user_id, identity.tenant_id, identity.aad_object_id);
  }
  return {ok:true,total:listed.users.length,activeMembers,disabled,guests,providers,managers,overlap,nonAuthors,indeterminate};
}

export async function bindDirectoryAuthorityUser(admin: SupabaseClient,userId:string,tenantId:string,aadObjectId:string) {
  await admin.from("bty_microsoft_directory_authority").update({linked_user_id:userId,updated_at:new Date().toISOString()}).eq("tenant_id",tenantId.toLowerCase()).eq("aad_object_id",aadObjectId.toLowerCase());
}
