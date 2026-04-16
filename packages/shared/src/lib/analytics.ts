export const AnalyticsEvents = {
  FEATURE_USED: "feature_used",
  PAGE_VIEWED: "page_viewed",
  ERROR_OCCURRED: "error_occurred",
  QUOTA_CHECK: "quota_check",
} as const;

export function trackFeature(
  featureName: string,
  properties?: Record<string, unknown>
): void {
  try {
    if (typeof window !== "undefined" && "posthog" in window) {
      (window as any).posthog.capture(AnalyticsEvents.FEATURE_USED, {
        feature: featureName,
        ...properties,
      });
    }
  } catch {
    // Silent fail — analytics should never break the app
  }
}

export interface QuotaUsage {
  provider: "supabase";
  metrics: {
    name: string;
    current: number;
    limit: number;
    percentage: number;
    unit: string;
  }[];
  timestamp: string;
}
