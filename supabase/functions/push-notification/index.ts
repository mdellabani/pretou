import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const POST_TYPE_TITLES: Record<string, string> = {
  annonce: "Annonce officielle",
  evenement: "Nouvel événement",
};

serve(async (req) => {
  const { record } = await req.json();
  const postType = record.type as string;

  // Only send push for annonce and evenement
  if (!POST_TYPE_TITLES[postType]) {
    return new Response("Post type not notifiable", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get all active users in the commune
  const { data: communeProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("commune_id", record.commune_id)
    .eq("status", "active");

  const userIds = (communeProfiles ?? []).map((p: { id: string }) => p.id);
  if (userIds.length === 0) {
    return new Response("No active users", { status: 200 });
  }

  // Get push tokens, excluding the post author
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .in("user_id", userIds)
    .neq("user_id", record.author_id);

  if (!tokens || tokens.length === 0) {
    return new Response("No push tokens", { status: 200 });
  }

  const title = POST_TYPE_TITLES[postType];
  const body =
    record.title.length > 80
      ? record.title.substring(0, 77) + "..."
      : record.title;

  // Expo push API accepts batches of up to 100
  const pushTokens = tokens.map((t: { token: string }) => t.token);
  const chunks: string[][] = [];
  for (let i = 0; i < pushTokens.length; i += 100) {
    chunks.push(pushTokens.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        chunk.map((token) => ({
          to: token,
          title,
          body,
          data: { postId: record.id, url: `/post/${record.id}` },
          sound: "default",
        }))
      ),
    });
  }

  return new Response(
    JSON.stringify({ sent: pushTokens.length }),
    { status: 200 }
  );
});
