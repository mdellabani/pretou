"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function regenerateInviteCodeAction(): Promise<{ newCode: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { newCode: null, error: "Non authentifié" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("commune_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return { newCode: null, error: "Non autorisé" };

  const newCode = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  const { error } = await supabase
    .from("communes")
    .update({ invite_code: newCode })
    .eq("id", profile.commune_id);

  if (error) return { newCode: null, error: error.message };

  revalidatePath("/admin/dashboard");
  return { newCode, error: null };
}
