import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import type { InboxConversation, MessageRow } from "../types/message";
import {
  sendMessageSchema,
  reportConversationSchema,
  type SendMessageInput,
  type ReportConversationInput,
} from "../validation/message.schema";

type Client = SupabaseClient<Database>;

const PAGE_SIZE = 20;
const MESSAGES_PAGE_SIZE = 50;

/**
 * Inbox: paginated list of conversations the current user participates in.
 * Returns counterpart info (display name + commune slug) and a derived
 * `unread` flag computed from the user's last_read_at vs last_message_at.
 */
export async function getConversations(
  supabase: Client,
  cursor?: string,
): Promise<{ rows: InboxConversation[]; nextCursor: string | null }> {
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) return { rows: [], nextCursor: null };
  const myId = me.user.id;

  let q = supabase
    .from("conversations")
    .select(`
      *,
      post:posts!inner(id, title, type),
      ua:profiles!conversations_user_a_fkey(id, display_name, commune:communes(slug)),
      ub:profiles!conversations_user_b_fkey(id, display_name, commune:communes(slug))
    `)
    .order("last_message_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) q = q.lt("last_message_at", cursor);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []).map((row: any): InboxConversation => {
    const counterpart =
      row.user_a === myId
        ? { id: row.ub.id, display_name: row.ub.display_name, commune_slug: row.ub.commune?.slug ?? "" }
        : { id: row.ua.id, display_name: row.ua.display_name, commune_slug: row.ua.commune?.slug ?? "" };
    const myLastRead =
      row.user_a === myId ? row.user_a_last_read_at : row.user_b_last_read_at;
    const unread =
      !!row.last_message_sender_id &&
      row.last_message_sender_id !== myId &&
      (!myLastRead || new Date(row.last_message_at) > new Date(myLastRead));

    return {
      ...row,
      counterpart,
      post: { id: row.post.id, title: row.post.title, type: row.post.type },
      unread,
    };
  });

  const hasMore = rows.length > PAGE_SIZE;
  const sliced = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const nextCursor = hasMore ? sliced[sliced.length - 1].last_message_at : null;
  return { rows: sliced, nextCursor };
}

/**
 * Returns one page of messages for a conversation, ordered chronologically
 * (oldest first) for natural rendering. Pagination cursor is keyed on
 * `created_at` of the oldest message returned.
 */
export async function getMessages(
  supabase: Client,
  conversationId: string,
  cursor?: string,
): Promise<{ messages: MessageRow[]; nextCursor: string | null }> {
  let q = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PAGE_SIZE + 1);

  if (cursor) q = q.lt("created_at", cursor);

  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > MESSAGES_PAGE_SIZE;
  const sliced = hasMore ? rows.slice(0, MESSAGES_PAGE_SIZE) : rows;
  return {
    messages: sliced.slice().reverse(),
    nextCursor: hasMore ? sliced[sliced.length - 1].created_at : null,
  };
}

/**
 * Find or create the canonical conversation between the current user and
 * `otherUserId` about `postId`. Canonicalizes user_a < user_b before insert.
 */
export async function getOrCreateConversation(
  supabase: Client,
  args: { postId: string; otherUserId: string },
): Promise<{ id: string; created: boolean }> {
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error("Not authenticated");
  const myId = me.user.id;

  if (myId === args.otherUserId) throw new Error("Cannot message yourself");

  const a = myId < args.otherUserId ? myId : args.otherUserId;
  const b = myId < args.otherUserId ? args.otherUserId : myId;

  const existing = await supabase
    .from("conversations")
    .select("id")
    .eq("post_id", args.postId)
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { id: existing.data.id, created: false };

  const inserted = await supabase
    .from("conversations")
    .insert({ post_id: args.postId, user_a: a, user_b: b })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  return { id: inserted.data.id, created: true };
}

export async function sendMessage(supabase: Client, input: SendMessageInput) {
  const parsed = sendMessageSchema.parse(input);
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.conversationId,
      sender_id: me.user.id,
      body: parsed.body.trim(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function markConversationRead(supabase: Client, conversationId: string) {
  const { error } = await supabase.rpc("mark_conversation_read", { conv_id: conversationId });
  if (error) throw error;
}

export async function blockUser(supabase: Client, blockedId: string) {
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: me.user.id, blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(supabase: Client, blockedId: string) {
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .match({ blocker_id: me.user.id, blocked_id: blockedId });
  if (error) throw error;
}

export async function getMyBlocks(supabase: Client) {
  const { data, error } = await supabase.from("user_blocks").select("blocked_id, created_at");
  if (error) throw error;
  return data ?? [];
}

export async function reportConversation(supabase: Client, input: ReportConversationInput) {
  const parsed = reportConversationSchema.parse(input);
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("conversation_reports")
    .insert({
      conversation_id: parsed.conversationId,
      reporter_id: me.user.id,
      reason: parsed.reason ?? null,
    });
  if (error) throw error;
}
