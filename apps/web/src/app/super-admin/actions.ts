"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SUPER_ADMIN_EMAILS } from "@/lib/super-admin";

async function requireSuperAdmin() {
  // Auth check with user's session
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? "")) {
    throw new Error("Unauthorized");
  }
  // Return service client for data queries (bypasses RLS)
  return { supabase: createServiceClient(), user };
}

export async function getPendingCommunes() {
  const { supabase } = await requireSuperAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, created_at, status, commune_id, communes!commune_id(id, name, slug, code_postal, created_at)")
    .eq("role", "admin")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function approveCommuneAction(profileId: string) {
  const { supabase } = await requireSuperAdmin();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "active" })
    .eq("id", profileId)
    .eq("role", "admin")
    .eq("status", "pending");

  if (error) return { error: error.message };
  return { success: true };
}

export async function rejectCommuneAction(profileId: string, communeId: string) {
  const { supabase } = await requireSuperAdmin();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", profileId);

  if (profileError) return { error: profileError.message };

  await supabase.from("communes").delete().eq("id", communeId);

  return { success: true };
}

export async function getAllCommunesAdmin() {
  const { supabase } = await requireSuperAdmin();

  const { data, error } = await supabase
    .from("communes")
    .select("id, name, slug, code_postal, created_at")
    .order("created_at", { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}
