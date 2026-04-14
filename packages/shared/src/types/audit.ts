export type AuditAction =
  | "post_hidden" | "post_deleted" | "post_restored"
  | "report_dismissed" | "report_actioned"
  | "producer_approved" | "producer_rejected"
  | "user_approved" | "role_changed";

export type AuditLog = {
  id: string;
  commune_id: string;
  actor_id: string | null;
  action: AuditAction;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
  profiles?: { display_name: string } | null;
};
