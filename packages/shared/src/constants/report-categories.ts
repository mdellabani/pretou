import type { ReportCategory } from "../types";

export const REPORT_CATEGORIES: { value: ReportCategory; label: string; emoji: string }[] = [
  { value: "inapproprie", label: "Contenu inapproprié", emoji: "🚫" },
  { value: "spam", label: "Spam / publicité", emoji: "📢" },
  { value: "illegal", label: "Contenu illégal", emoji: "⚠️" },
  { value: "doublon", label: "Doublon", emoji: "🔄" },
  { value: "autre", label: "Autre", emoji: "🤷" },
];
