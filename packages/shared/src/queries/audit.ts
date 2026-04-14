import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AuditAction } from "../types";

type Client = SupabaseClient<Database>;

export async function logAction(client: Client, communeId: string, actorId: string | null, action: AuditAction, targetType: string, targetId: string, reason?: string | null) {
  return client.from("audit_log").insert({ commune_id: communeId, actor_id: actorId, action, target_type: targetType, target_id: targetId, reason: reason ?? null });
}

export async function getAuditLog(client: Client, communeId: string, limit = 50) {
  return client.from("audit_log").select("*, profiles!actor_id(display_name)").eq("commune_id", communeId).order("created_at", { ascending: false }).limit(limit);
}

export async function getMyAuditLog(client: Client, actorId: string, limit = 50) {
  return client.from("audit_log").select("*, profiles!actor_id(display_name)").eq("actor_id", actorId).order("created_at", { ascending: false }).limit(limit);
}
