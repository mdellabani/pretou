export type ReportCategory = "inapproprie" | "spam" | "illegal" | "doublon" | "autre";
export type ReportStatus = "pending" | "dismissed" | "actioned";

export type Report = {
  id: string;
  post_id: string;
  reporter_id: string;
  category: ReportCategory;
  reason: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: { display_name: string };
};
