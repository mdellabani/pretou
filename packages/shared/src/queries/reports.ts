import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReportCategory } from "../types";

type Client = SupabaseClient<Database>;

export async function createReport(client: Client, postId: string, reporterId: string, category: ReportCategory, reason: string | null) {
  return client.from("reports").insert({ post_id: postId, reporter_id: reporterId, category, reason }).select().single();
}

export async function getPendingReports(client: Client, communeId: string) {
  return client.from("reports").select("*, profiles!reporter_id(display_name), posts!post_id(id, title, author_id, commune_id, profiles!author_id(display_name))").eq("status", "pending").order("created_at", { ascending: false });
}

export async function getReportsByPost(client: Client, postId: string) {
  return client.from("reports").select("*, profiles!reporter_id(display_name)").eq("post_id", postId).order("created_at", { ascending: false });
}

export async function dismissReport(client: Client, reportId: string, reviewerId: string) {
  return client.from("reports").update({ status: "dismissed", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() }).eq("id", reportId);
}

export async function actionReport(client: Client, reportId: string, reviewerId: string) {
  return client.from("reports").update({ status: "actioned", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() }).eq("id", reportId);
}

export async function getReporterStats(client: Client, reporterId: string) {
  const { data } = await client.from("reports").select("status").eq("reporter_id", reporterId);
  const total = data?.length ?? 0;
  const dismissed = data?.filter((r) => r.status === "dismissed").length ?? 0;
  return { total, dismissed };
}

export async function hasUserReported(client: Client, postId: string, userId: string) {
  const { data } = await client.from("reports").select("id").eq("post_id", postId).eq("reporter_id", userId).maybeSingle();
  return !!data;
}
