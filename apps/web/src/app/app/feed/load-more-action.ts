"use server";

import { createClient } from "@/lib/supabase/server";
import type { Post } from "@rural-community-platform/shared";

export async function loadMorePosts(
  communeId: string,
  cursor: string,
  types: string[],
  dateFilter: string
) {
  const supabase = await createClient();

  let query = supabase
    .from("posts")
    .select(
      "*, profiles!author_id(display_name, avatar_url), post_images(id, storage_path), comments(count), rsvps(status)"
    )
    .eq("commune_id", communeId)
    .eq("is_hidden", false)
    .eq("is_pinned", false)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .lt("created_at", cursor)
    .order("created_at", { ascending: false })
    .limit(20);

  if (types.length > 0) {
    query = query.in("type", types);
  }

  if (dateFilter === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    query = query.gte("created_at", d.toISOString());
  } else if (dateFilter === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    query = query.gte("created_at", d.toISOString());
  } else if (dateFilter === "month") {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    query = query.gte("created_at", d.toISOString());
  }

  const { data } = await query;
  return (data ?? []) as Post[];
}
