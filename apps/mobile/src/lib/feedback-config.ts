export type FeedbackType = "bug" | "feature";

export interface FeedbackFormData {
  type: FeedbackType;
  category: string;
  title: string;
  description: string;
  screenshot?: string;
}

export interface FeedbackContext {
  url: string;
  userAgent: string;
  appVersion: string;
  timestamp: string;
}

export const DEFAULT_BUG_CATEGORIES = [
  "UI/Display",
  "Performance",
  "Crash/Error",
  "Data/Content",
  "Other",
];

export const DEFAULT_FEATURE_CATEGORIES = [
  "New Feature",
  "Improvement",
  "UI/UX",
  "Integration",
  "Other",
];

export function buildIssueBody(
  data: FeedbackFormData,
  context: FeedbackContext
): string {
  const sections = [
    `## Description\n\n${data.description}`,
    `## Category\n\n${data.category}`,
    `## Context\n\n- **URL:** ${context.url}\n- **User Agent:** ${context.userAgent}\n- **App Version:** ${context.appVersion}\n- **Timestamp:** ${context.timestamp}`,
  ];

  if (data.screenshot) {
    sections.push(
      `## Screenshot\n\n![Screenshot](data:image/png;base64,${data.screenshot})`
    );
  }

  return sections.join("\n\n");
}
