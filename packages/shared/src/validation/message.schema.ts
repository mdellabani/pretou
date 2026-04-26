import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, "Message vide").max(4000, "Message trop long"),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const startConversationSchema = z.object({
  postId: z.string().uuid(),
  otherUserId: z.string().uuid(),
});
export type StartConversationInput = z.infer<typeof startConversationSchema>;

export const reportConversationSchema = z.object({
  conversationId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});
export type ReportConversationInput = z.infer<typeof reportConversationSchema>;
