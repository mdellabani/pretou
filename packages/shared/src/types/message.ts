import type { Database } from "./database";

export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type ConversationInsert = Database["public"]["Tables"]["conversations"]["Insert"];

export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];

export type UserBlockRow = Database["public"]["Tables"]["user_blocks"]["Row"];

export type ConversationReportRow = Database["public"]["Tables"]["conversation_reports"]["Row"];

/**
 * Inbox row: a conversation joined with the counterpart's display name +
 * commune slug (for the cross-commune banner) and the post title.
 */
export type InboxConversation = ConversationRow & {
  counterpart: {
    id: string;
    display_name: string;
    commune_slug: string;
  };
  post: {
    id: string;
    title: string;
    type: string;
  };
  unread: boolean;
};
