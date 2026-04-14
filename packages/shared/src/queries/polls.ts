import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CreatePollInput } from "../types";

type Client = SupabaseClient<Database>;

export async function getPollByPostId(client: Client, postId: string) {
  return client
    .from("polls")
    .select("*, poll_options(*, poll_votes(user_id))")
    .eq("post_id", postId)
    .order("position", { referencedTable: "poll_options", ascending: true })
    .maybeSingle();
}

export async function createPoll(client: Client, postId: string, input: CreatePollInput) {
  const { data: poll, error: pollError } = await client
    .from("polls")
    .insert({
      post_id: postId,
      question: input.question,
      poll_type: input.poll_type,
      allow_multiple: input.allow_multiple,
    })
    .select()
    .single();

  if (pollError || !poll) return { data: null, error: pollError };

  const options = input.options.map((label, i) => ({
    poll_id: poll.id,
    label,
    position: i,
  }));

  const { error: optError } = await client.from("poll_options").insert(options);
  if (optError) return { data: null, error: optError };

  return { data: poll, error: null };
}

export async function vote(client: Client, optionId: string, userId: string) {
  return client.from("poll_votes").upsert({ poll_option_id: optionId, user_id: userId }).select().single();
}

export async function removeVote(client: Client, optionId: string, userId: string) {
  return client.from("poll_votes").delete().eq("poll_option_id", optionId).eq("user_id", userId);
}
