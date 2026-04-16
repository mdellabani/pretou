import { PostHogProvider } from "@posthog/next";

export function PostHogMonitoringProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      apiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}
      clientOptions={{
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        capture_pageview: true,
        capture_pageleave: true,
      }}
    >
      {children}
    </PostHogProvider>
  );
}
