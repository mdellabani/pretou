import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CreateProducerInput } from "../types";

type Client = SupabaseClient<Database>;

export async function getProducers(client: Client) {
  return client
    .from("producers")
    .select("*, communes(name), profiles!created_by(display_name)")
    .eq("status", "active")
    .order("name", { ascending: true });
}

export async function getPendingProducers(client: Client, communeId: string) {
  return client
    .from("producers")
    .select("*, profiles!created_by(display_name)")
    .eq("commune_id", communeId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
}

export async function createProducer(client: Client, communeId: string, createdBy: string, input: CreateProducerInput) {
  return client
    .from("producers")
    .insert({ ...input, commune_id: communeId, created_by: createdBy })
    .select()
    .single();
}

export async function approveProducer(client: Client, producerId: string) {
  return client.from("producers").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", producerId);
}

export async function rejectProducer(client: Client, producerId: string) {
  return client.from("producers").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", producerId);
}

export async function deleteProducer(client: Client, producerId: string) {
  return client.from("producers").delete().eq("id", producerId);
}
